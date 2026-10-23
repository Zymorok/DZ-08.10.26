import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) return [];
    const rooms = await ctx.db.query("chatRooms").collect();
    return rooms.sort(
      (a, b) =>
        (b.lastMessageAt ?? b._creationTime) -
        (a.lastMessageAt ?? a._creationTime),
    );
  },
});

export const getRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return null;
    const id = ctx.db.normalizeId("chatRooms", args.roomId);
    return id ? await ctx.db.get(id) : null;
  },
});

export const createRoom = mutation({
  args: { title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Потрібно увійти в акаунт");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Користувача не знайдено");
    const title = args.title.trim();
    const description = args.description?.trim();
    if (!title || title.length > 100)
      throw new Error("Назва має містити від 1 до 100 символів");
    if (description && description.length > 300)
      throw new Error("Опис має містити до 300 символів");
    return await ctx.db.insert("chatRooms", {
      title,
      description: description || undefined,
      creatorId: userId,
      creatorName: user.fullname || user.name || user.email || "Користувач",
    });
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Потрібно увійти в акаунт");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new ConvexError("Кімнату не знайдено");
    if (room.creatorId !== userId)
      throw new ConvexError("Видалити кімнату може лише її автор");
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const message of messages) {
      if (message.storageId) await ctx.storage.delete(message.storageId);
      await ctx.db.delete(message._id);
    }
    const typing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const indicator of typing) await ctx.db.delete(indicator._id);
    await ctx.db.delete(args.roomId);
    return { success: true };
  },
});
