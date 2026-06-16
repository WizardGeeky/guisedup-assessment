import { commentRepository, CommentWithAuthor } from "../repositories/commentRepository";
import { notificationRepository } from "../repositories/notificationRepository";
import { postRepository } from "../repositories/postRepository";
import { NotFoundError } from "../utils/errors";

export const commentService = {
  async getComments(postId: string): Promise<CommentWithAuthor[]> {
    return commentRepository.findByPost(postId);
  },

  async addComment(
    postId: string,
    authorId: string,
    text: string,
  ): Promise<{ comment: CommentWithAuthor; notifyUserId: string | null }> {
    const post = await postRepository.findById(postId);
    if (!post) throw new NotFoundError("Post");

    const comment = await commentRepository.create(postId, authorId, text);

    let notifyUserId: string | null = null;
    if (post.authorId !== authorId) {
      await notificationRepository.create({
        userId: post.authorId,
        fromUserId: authorId,
        type: "COMMENT",
        postId,
        commentId: comment.id,
        message: `${comment.author.username} commented on your post`,
      });
      notifyUserId = post.authorId;
    }

    return { comment, notifyUserId };
  },

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const deleted = await commentRepository.delete(commentId, userId);
    if (!deleted) throw new NotFoundError("Comment");
  },
};
