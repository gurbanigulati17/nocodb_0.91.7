import axios from 'axios';

export default class Discord {
  public static async sendMessage(
    content: string,
    webhooks: Array<{
      webhook_url: string;
    }>
  ): Promise<any> {
    for (const { webhook_url } of webhooks) {
      try {
        await axios.post(webhook_url, {
          content
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
}
