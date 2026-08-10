import { productMediaStorageService } from '../commerce/product-media-storage.service.js';

export const bannerMediaStorageService = {
  async upload(input: {
    fileName: string;
    mimeType: string;
    dataBase64: string;
    bannerId?: string | null;
  }) {
    return productMediaStorageService.upload({
      fileName: input.fileName,
      mimeType: input.mimeType,
      dataBase64: input.dataBase64,
      productId: input.bannerId?.trim() || 'banners',
      folder: 'images',
    });
  },
};
