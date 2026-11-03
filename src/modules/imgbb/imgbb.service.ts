import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';

@Injectable()
export class ImgBBService {
  constructor(
    @Inject('IMGBB_HTTP_PROVIDER') private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async uploadImage(image: string, imageType: string): Promise<string | null> {
    const requestData = new URLSearchParams();
    requestData.append('image', image);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `/1/upload?key=${this.configService.get(envEnums.IMGBB_API_KEY)}`,
          requestData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );
      return imageType === 'logo'
        ? response.data.data.thumb.url
        : response.data.data.medium.url;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}
