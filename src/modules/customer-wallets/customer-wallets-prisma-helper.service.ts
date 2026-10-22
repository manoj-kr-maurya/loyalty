import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
@Injectable()
export class CustomerWalletsPrismaHelperService {
  constructor(private readonly prismaService: PrismaService) {}
}
