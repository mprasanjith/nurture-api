import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(pushToken: string, title: string, body: string) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return;
    }
  
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
    };
  
    try {
      await expo.sendPushNotificationsAsync([message]);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }
  