import { messageRepository, MessageWithUsers, ConversationPreview } from "../repositories/messageRepository";
import { notificationRepository } from "../repositories/notificationRepository";
import { userRepository } from "../repositories/userRepository";
import { NotFoundError } from "../utils/errors";

export const messageService = {
  async getConversationList(userId: string): Promise<ConversationPreview[]> {
    return messageRepository.getConversationList(userId);
  },

  async getConversation(viewerId: string, otherUserId: string): Promise<MessageWithUsers[]> {
    await messageRepository.markRead(otherUserId, viewerId);
    return messageRepository.getConversation(viewerId, otherUserId);
  },

  async sendMessage(fromUserId: string, toUserId: string, text: string): Promise<MessageWithUsers> {
    const recipient = await userRepository.findById(toUserId);
    if (!recipient) throw new NotFoundError("User");

    const message = await messageRepository.send(fromUserId, toUserId, text);

    await notificationRepository.create({
      userId: toUserId,
      fromUserId,
      type: "MESSAGE",
      message: `${message.fromUser.username} sent you a message`,
    });

    return message;
  },
};
