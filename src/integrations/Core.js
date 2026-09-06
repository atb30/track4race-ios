// Reemplazo local del cargador de Base44. Las imágenes se guardan como data URL
// junto con la configuración; para archivos grandes usa un almacenamiento propio.
export async function UploadFile({ file }) {
  if (!file) throw new Error('No se recibió ningún archivo');
  const file_url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  return { file_url };
}
