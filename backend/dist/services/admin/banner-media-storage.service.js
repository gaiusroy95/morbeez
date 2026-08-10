import { productMediaStorageService } from '../commerce/product-media-storage.service.js';
export const bannerMediaStorageService = {
    async upload(input) {
        return productMediaStorageService.upload({
            fileName: input.fileName,
            mimeType: input.mimeType,
            dataBase64: input.dataBase64,
            productId: input.bannerId?.trim() || 'banners',
            folder: 'images',
        });
    },
};
//# sourceMappingURL=banner-media-storage.service.js.map