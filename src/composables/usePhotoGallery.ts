import { ref, onMounted, watch } from 'vue';
import { isPlatform } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Storage } from '@capacitor/storage'
//* 定義一個用來存放照片的陣列 */
const photos = ref<UserPhoto[]>([]);

const convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result);
    };
    reader.readAsDataURL(blob);
});

//* 儲存照片
const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
  
    // Fetch the photo, read as a blob, then convert to base64 format
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    let base64Data = await convertBlobToBase64(blob) as string;

    // 使用platform API偵測環境是否為行動裝置
    if (isPlatform('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path!
      });
      base64Data = file.data;
    } else {
      // 不是行動裝置則自動使用之前的方式儲存
      base64Data = await convertBlobToBase64(blob) as string;
    }
  
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });
    //* 同樣在此判斷是否為行動裝置來選擇回傳檔案位置的方式 */
    if (isPlatform('hybrid')) {
        // Display the new image by rewriting the 'file://' path to HTTP
        // Details: https://ionicframework.com/docs/building/webview#file-protocol
        return {
          filepath: savedFile.uri,
          webviewPath: Capacitor.convertFileSrc(savedFile.uri),
        };
    }
    else 
    {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: photo.webPath
      };
    }
}

export function usePhotoGallery() {
    const PHOTO_STORAGE = "photos";
    const cachePhotos = () => {
        Storage.set({
          key: PHOTO_STORAGE,
          value: JSON.stringify(photos.value)
        });
    }

    //*讀取已經儲存起來的照片 */
    const loadSaved = async () => {
        const photoList = await Storage.get({ key: PHOTO_STORAGE });
        const photosInStorage = photoList.value ? JSON.parse(photoList.value) : [];
      
        // If running on the web...
        if (!isPlatform('hybrid')) {
          for (const photo of photosInStorage) {
            const file = await Filesystem.readFile({
              path: photo.filepath,
              directory: Directory.Data
            });
            // Web platform only: Load the photo as base64 data
            photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
          }
        }
      
        photos.value = photosInStorage;
    }

    //* 拍照
    const takePhoto = async () => {
      //* 使用camera這個裝置原生API提供的方法getPhoto獲取照片
      const cameraPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 100
      });
      //* 把照片存在一個專為相片做的陣列裡
      const fileName = new Date().getTime() + '.jpeg';
      const savedFileImage = await savePicture(cameraPhoto, fileName)
      
      photos.value = [savedFileImage, ...photos.value];
    };  
    
    //* 使用watch去監聽photos陣列，當陣列有所變動時執行cachePhotos
    watch(photos, cachePhotos);

    //* 使用onMounted去觸發讀取照片的方法 */
    onMounted(loadSaved);
  
    return {
      photos,
      takePhoto
    };
}

//*定義用來存放照片的介面 內容包含檔案名稱以及相片的位置 */
export interface UserPhoto {
    filepath: string;
    webviewPath?: string;
}