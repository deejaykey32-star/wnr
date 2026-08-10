import QRCode from 'qrcode';

/**
 * Generates a QR Code image as a Data URI string (image/png).
 * @param text The text or URL to encode into QR Code.
 * @returns Promise<string> Data URI of generated PNG image.
 */
export const generateQrCodeDataUri = async (text: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: 300,
      color: {
        dark: '#0f172aff', // slate-900
        light: '#ffffffff'
      },
      errorCorrectionLevel: 'M'
    });
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Fallback minimal transparent png if generation fails
    return 'data:image/png;base64,iVBORw0KGgoAAAANSU5QMAAAABJRU5ErkJggg==';
  }
};
