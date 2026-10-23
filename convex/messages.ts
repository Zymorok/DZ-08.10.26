import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query } from "./_generated/server";

async function updateLastMessage(ctx: MutationCtx, roomId: Id<"chatRooms">) {
  const last = await ctx.db
    .query("messages")
    .withIndex("by_chat_room", (q) => q.eq("chatRoomId", roomId))
    .order("desc")
    .first();
  await ctx.db.patch(roomId, {
    lastMessage: last
      ? `${last.senderName}: ${last.audioUrl ? "🎤 Голосове повідомлення" : last.videoUrl ? "📹 Відеоповідомлення" : last.imageUrl ? "📷 Фото" + (last.content ? " — " + last.content : "") : last.content}`
      : undefined,
    lastMessageAt: last?._creationTime,
  });
}

async function getReply(ctx: MutationCtx, roomId: Id<"chatRooms">, id?: Id<"messages">) {
  if (!id) return {};
  const message = await ctx.db.get(id);
  if (!message || message.chatRoomId !== roomId)
    throw new Error("Повідомлення для відповіді не знайдено в цій кімнаті");
  return {
    replyToId: message._id,
    replyToSender: message.senderName,
    replyToText: message.content || (message.audioUrl ? "🎤 Голосове повідомлення" : message.videoUrl ? "📹 Відеоповідомлення" : "📷 Фотографія"),
  };
}

export const listMessages = query({
  args: { chatRoomId: v.string() },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const id = ctx.db.normalizeId("chatRooms", args.chatRoomId);
    if (!id || !(await ctx.db.get(id))) return [];
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", id))
      .order("asc")
      .collect();
    return await Promise.all(messages.map(async message => ({
      ...message,
      senderPhoto: (await ctx.db.get(message.senderId))?.image,
    })));
  },
});

export const getPaginatedMessages = query({
  args: { chatRoomId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("chatRooms", args.chatRoomId);
    if (!(await getAuthUserId(ctx)) || !roomId || !(await ctx.db.get(roomId)))
      return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db.query("messages")
      .withIndex("by_chat_room", q => q.eq("chatRoomId", roomId))
      .order("desc").paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(async message => ({
        ...message,
        senderPhoto: (await ctx.db.get(message.senderId))?.image,
      }))),
    };
  },
});

export const sendMessage = mutation({
  args: { chatRoomId: v.id("chatRooms"), content: v.string(), replyToId: v.optional(v.id("messages")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Потрібно увійти в акаунт");
    const user = await ctx.db.get(userId);
    if (!user || !(await ctx.db.get(args.chatRoomId)))
      throw new Error("Кімнату не знайдено");
    const content = args.content.trim();
    if (!content || content.length > 2000)
      throw new Error("Повідомлення має містити від 1 до 2000 символів");
    const id = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.fullname || user.name || user.email || "Користувач",
      senderPhoto: user.image,
      ...await getReply(ctx, args.chatRoomId, args.replyToId),
      content,
    });
    await updateLastMessage(ctx, args.chatRoomId);
    return id;
  },
});

export const editMessage = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Потрібно увійти в акаунт");
    const message = await ctx.db.get(args.messageId);
    if (!message || message.senderId !== userId)
      throw new Error("Можна редагувати лише власні повідомлення");
    if (message.audioUrl || message.videoUrl)
      throw new ConvexError("Можна редагувати лише текст і підпис до фото");
    const content = args.content.trim();
    if ((!content && !message.imageUrl) || content.length > 2000)
      throw new Error("Перевірте текст повідомлення");
    await ctx.db.patch(message._id, {
      content: content || undefined,
      isEdited: true,
    });
    await updateLastMessage(ctx, message.chatRoomId);
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Потрібно увійти в акаунт");
    const message = await ctx.db.get(args.messageId);
    if (!message || message.senderId !== userId)
      throw new Error("Можна видаляти лише власні повідомлення");
    for (const fileId of [message.storageId, message.audioStorageId, message.videoStorageId])
      if (fileId) await ctx.storage.delete(fileId);
    const reactions = await ctx.db.query("messageReactions")
      .withIndex("by_message", q => q.eq("messageId", message._id)).collect();
    for (const reaction of reactions) await ctx.db.delete(reaction._id);
    await ctx.db.delete(message._id);
    await updateLastMessage(ctx, message.chatRoomId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx)))
      throw new Error("Потрібно увійти в акаунт");
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMediaMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Потрібно увійти в акаунт");
    const user = await ctx.db.get(userId);
    if (!user || !(await ctx.db.get(args.chatRoomId)))
      throw new Error("Кімнату не знайдено");
    const file = await ctx.db.system.get(args.storageId);
    if (
      !file ||
      !file.contentType?.startsWith("image/") ||
      file.size > 10 * 1024 * 1024
    ) {
      throw new Error("Оберіть зображення розміром до 10 МБ");
    }
    const content = args.caption?.trim();
    if (content && content.length > 2000)
      throw new Error("Підпис має містити до 2000 символів");
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) throw new Error("Зображення не знайдено");
    const id = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.fullname || user.name || user.email || "Користувач",
      senderPhoto: user.image,
      ...await getReply(ctx, args.chatRoomId, args.replyToId),
      content: content || undefined,
      storageId: args.storageId,
      imageUrl,
    });
    await updateLastMessage(ctx, args.chatRoomId);
    return id;
  },
});

async function saveRecording(ctx: MutationCtx, args: {
  chatRoomId: Id<"chatRooms">;
  storageId: Id<"_storage">;
  duration: number;
  replyToId?: Id<"messages">;
}, type: "audio" | "video") {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Потрібно увійти в акаунт");
  const user = await ctx.db.get(userId);
  if (!user || !(await ctx.db.get(args.chatRoomId)))
    throw new ConvexError("Кімнату не знайдено");
  const file = await ctx.db.system.get(args.storageId);
  const limit = type === "audio" ? 120 : 60;
  if (!file || !file.contentType?.startsWith(type + "/") ||
      file.size > (type === "audio" ? 10 : 25) * 1024 * 1024 ||
      !Number.isFinite(args.duration) || args.duration <= 0 || args.duration > limit + 1)
    throw new ConvexError("Перевірте формат, розмір і тривалість запису");
  const url = await ctx.storage.getUrl(args.storageId);
  if (!url) throw new ConvexError("Запис не знайдено");
  const id = await ctx.db.insert("messages", {
    chatRoomId: args.chatRoomId,
    senderId: userId,
    senderName: user.fullname || user.name || user.email || "Користувач",
    senderPhoto: user.image,
    ...await getReply(ctx, args.chatRoomId, args.replyToId),
    ...(type === "audio"
      ? { audioUrl: url, audioStorageId: args.storageId, audioDuration: args.duration }
      : { videoUrl: url, videoStorageId: args.storageId, videoDuration: args.duration, isVideoNote: true }),
  });
  await updateLastMessage(ctx, args.chatRoomId);
  return id;
}

export const sendAudioMessage = mutation({
  args: { chatRoomId: v.id("chatRooms"), storageId: v.id("_storage"), duration: v.number(), replyToId: v.optional(v.id("messages")) },
  handler: (ctx, args) => saveRecording(ctx, args, "audio"),
});

export const sendVideoNoteMessage = mutation({
  args: { chatRoomId: v.id("chatRooms"), storageId: v.id("_storage"), duration: v.number(), replyToId: v.optional(v.id("messages")) },
  handler: (ctx, args) => saveRecording(ctx, args, "video"),
});
