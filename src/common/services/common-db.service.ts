import { Injectable } from '@nestjs/common';
import { Invite, Interest, Prisma } from '@prisma/client';
import {
  InviteCodeNotFoundException,
  ShopInvitesNotFoundException,
} from '../exceptions/common.exception';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class CommonDBService {
  constructor(private prisma: PrismaService) {}

  async findInvite(where: Prisma.InviteWhereUniqueInput) {
    try {
      return await this.prisma.invite.findFirstOrThrow({
        where,
      });
    } catch {
      throw new InviteCodeNotFoundException();
    }
  }

  async findManyInvites(where: Prisma.InviteWhereInput) {
    try {
      return await this.prisma.invite.findMany({
        where,
      });
    } catch {
      throw new ShopInvitesNotFoundException();
    }
  }

  async createInvite(form: Prisma.InviteCreateInput): Promise<Invite> {
    return await this.prisma.invite.create({ data: form });
  }

  async createInterest(form: Prisma.InterestCreateInput): Promise<Interest> {
    return await this.prisma.interest.create({ data: form });
  }
  async updateInvite(
    newInvite: Prisma.InviteUpdateInput,
    where: Prisma.InviteWhereUniqueInput,
  ): Promise<Invite> {
    return await this.prisma.invite.update({
      where,
      data: newInvite,
    });
  }
}
