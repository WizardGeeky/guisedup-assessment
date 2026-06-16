import { Interaction, InteractionType } from "@prisma/client";
import { interactionRepository } from "../repositories/interactionRepository";
import { postRepository } from "../repositories/postRepository";
import { notificationRepository } from "../repositories/notificationRepository";
import { userRepository } from "../repositories/userRepository";
import { NotFoundError } from "../utils/errors";

export interface LogInteractionInput {
  userId: string;
  postId: string;
  type: InteractionType;
}

export interface LogInteractionResult {
  interaction: Interaction;
  notifyUserId: string | null;
  reactorUsername: string | null;
}

export const interactionService = {
  async logInteraction(input: LogInteractionInput): Promise<LogInteractionResult> {
    // Verify post exists
    const post = await postRepository.findById(input.postId);
    if (!post) throw new NotFoundError("Post");

    const interaction = await interactionRepository.upsert(input);

    if (input.type === "VIEW") {
      await postRepository.incrementViewCount(input.postId);
    }

    let notifyUserId: string | null = null;
    let reactorUsername: string | null = null;

    // Notify post owner on first REACTION (skip own posts)
    if (input.type === "REACTION" && post.authorId !== input.userId) {
      const reactor = await userRepository.findById(input.userId);
      if (reactor) {
        reactorUsername = reactor.username;
        await notificationRepository.create({
          userId: post.authorId,
          fromUserId: input.userId,
          type: "REACTION",
          postId: input.postId,
          message: `${reactor.username} reacted to your post`,
        });
        notifyUserId = post.authorId;
      }
    }

    return { interaction, notifyUserId, reactorUsername };
  },

  async getPostInteractionCounts(postId: string) {
    return interactionRepository.countByPost(postId);
  },
};
