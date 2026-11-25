/**
 * Redimensiona e comprime fotos grandes de smartphone no navegador (máx 1024px, JPEG 0.82)
 * antes de enviar ao backend — reduz upload e latência do Gemini Vision em até 5-10x
 * mantendo carimbos de validade perfeitamente legíveis.
 */
export async function compressImageForVision(file: File): Promise<{
  file: File;
  previewUrl: string;
}> {
  const previewUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

  // Imagens já pequenas (< 250 KB) em JPEG/PNG/WEBP não precisam de recompressão pesada
  if (file.size <= 250 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    return { file, previewUrl };
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Formato não decodificável no canvas.'));
      el.src = previewUrl;
    });

    const maxDim = 1024;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, previewUrl };

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob) return { file, previewUrl };

    const compressedName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
    const compressedFile = new File([blob], compressedName, { type: 'image/jpeg' });
    return { file: compressedFile, previewUrl };
  } catch {
    // Fallback seguro caso o browser não decodifique HEIC no canvas
    return { file, previewUrl };
  }
}
