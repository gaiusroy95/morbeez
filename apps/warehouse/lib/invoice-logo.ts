import { Image } from 'react-native';

/** Bundled Morbeez logo for invoice PDF/print when company settings have no logo URL. */
export const INVOICE_LOGO_URI = Image.resolveAssetSource(require('../assets/logo.png')).uri;
