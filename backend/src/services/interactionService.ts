import { Interaction, InteractionType } from "@prisma/client";
import { interactionRepository } from "../repositories/interactionRepository";
import { postRepository } from "../repositories/postRepository";
import { NotFoundError } from "../utils/errors";

export interface LogInteractionInput {
  userId: string;
  postId: string;
  type: InteractionType;
}

export const interactionService = {
  async logInteraction(input: LogInteractionInput): Promise<Interaction> {
    // Verify post exists
    const post = await postRepository.findById(input.postId);
    if (!post) throw new NotFoundError("Post");

    const interaction = await interactionRepository.upsert(input);

    // Increment view count on the post for quick aggregation queries
    if (input.type === "VIEW") {
      await postRepository.incrementViewCount(input.postId);
    }

    return interaction;
  },

  async getPostInteractionCounts(postId: string) {
    return interactionRepository.countByPost(postId);
  },
};
