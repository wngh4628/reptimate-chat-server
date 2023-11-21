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
  async sendFCM(fbTokens: string, title: string, description: string) {
    try {

      const message
      = {
        // notification: {
        //   title: title,
        //   body: description,
        // },
        data: {
          title: title,
          body: description,
          
        },
        tokens: [fbTokens],
        // token: fbTokens,
        // android: {
        //   data: {},
        // },
        // apns: {
        //   payload: {
        //     aps: {},
        //   },
        // },
      };

      this.fcm.sendEachForMulticast(message);
      // this.fcm.send(message);
    } catch (error) {
      console.log('Error sending messages:', error);
    }
  }
}
