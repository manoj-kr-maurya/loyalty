import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { OrganizationService } from '../organization/organization.service';
import { UpdateShopForm } from './DTO/shop.dto';
import { OrganizationRoles } from '@prisma/client';

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationService: OrganizationService,
  ) {}
  async fetchActiveShopsOfAnOrg(orgId: string) {
    return this.prisma.organization.findMany({
      where: { orgAdminId: orgId, role: OrganizationRoles.SHOP },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        address: true,
        upiURI: true,
        aboutUs: true,
        contactUs: true,
        operationalHours: true,
      },
    });
  }

  async updateShop(organizationAdminId: string, form: UpdateShopForm) {
    const { shopId, ...newForm } = form;
    const shop = await this.prisma.organization.findFirst({
      where: {
        id: shopId,
      },
    });
    if (!shop) {
      throw new Error('Shop not found');
    }
    if (shop.orgAdminId !== organizationAdminId) {
      throw new Error('You are not authorized to update this shop');
    }
    return await this.organizationService.someFunctionThatMyUpdateOrganizationEndPointWillCall(
      shopId,
      newForm,
    );
  }
}
