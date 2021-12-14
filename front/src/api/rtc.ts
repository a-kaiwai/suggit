import { io, Socket } from "socket.io-client";

import { Discussion, DiscussionUpdateAction } from "sugit_types/discussion";

class RTC {
  socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  async createDiscussion({ name }: { name: string }) {
    await this.emitRTC("create_discussion", { name });
  }
  async joinDiscussion(discussionId: string) {
    await this.emitRTC("join_discussion", { discussion_id: discussionId });
  }
  async getDiscussion(discussionId: string): Promise<Discussion> {
    return await this.emitRTC("get_discussion", {
      discussion_id: discussionId,
    });
  }
  async updateDiscussion(discussionId: string, action: DiscussionUpdateAction) {
    return await this.emitRTC("update_discussion", {
      discussion_id: discussionId,
      action,
    });
  }

  isConnected() {
    return this.socket.connected;
  }

  private emitRTC(type: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log("[RTC] emit", type, data);
      this.socket.emit(type, data, (response: any) => {
        if (response["error"] !== undefined) {
          console.log("[RTC] ERROR ACK", response);
          reject(response["error"]);
        }
        console.log("[RTC] ACK");
        resolve(response);
      });
    });
  }
}

const createRTC = (): RTC => {
  return new RTC(io("http://localhost:8080"));
};

export { createRTC };
