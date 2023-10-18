import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('../../firebase-adminsdk.json');

@Injectable()
export class FCMService {
  private fcm: admin.messaging.Messaging;
  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    this.fcm = admin.messaging();
  }
  async sendFCM(type:string, fbTokens: string, title: string, description: string) {
    try {
      const message = {
        notification: {
          type: type,
          title: title,
          body: description,
        },
        tokens: [fbTokens],
        android: {
          data: {},
        },
        apns: {
          payload: {
            aps: {},
          },
        },
      };

      this.fcm.sendEachForMulticast(message);
    } catch (error) {
      console.log('Error sending messages:', error);
    }
  }
}
