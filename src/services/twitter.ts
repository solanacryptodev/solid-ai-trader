import { TwitterData } from "~/libs/interfaces";

export class TwitterService {
  private baseUrl = '';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchTweets(): Promise<TwitterData[]> {

    return 
  }
}