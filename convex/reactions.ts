import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Потрібно увійти в акаунт");
    if (!["👍", "❤️", "😂", "🔥", "😮", "😢"].includes(args.emoji))
      throw new ConvexError("Оберіть реакцію зі списку");
    const message = await ctx.db.get(args.messageId);
    if (!message || !(await ctx.db.get(message.chatRoomId)))
      throw new ConvexError("Повідомлення не знайдено");
    const existing = await ctx.db.query("messageReactions")
      .withIndex("by_message_user_emoji", q => q.eq("messageId", args.messageId).eq("userId", userId).eq("emoji", args.emoji))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    else await ctx.db.insert("messageReactions", { ...args, userId });
  },
});

export const getMessageReactions = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ctx.db.get(args.messageId))) return [];
    const reactions = await ctx.db.query("messageReactions")
      .withIndex("by_message", q => q.eq("messageId", args.messageId)).collect();
    const result: { emoji: string; count: number; active: boolean }[] = [];
    for (const reaction of reactions) {
      let group = result.find(item => item.emoji === reaction.emoji);
      if (!group) {
        group = { emoji: reaction.emoji, count: 0, active: false };
        result.push(group);
      }
      group.count++;
      if (reaction.userId === userId) group.active = true;
    }
    return result;
  },
});
