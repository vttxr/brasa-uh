import {safeImage} from './safety.js';

// Keep the brand visible if a stale cache or failed download breaks the main image.
export function initImageFallbacks(doc=document) {
 for(const img of doc.querySelectorAll('img[data-fallback-src]')) {
  const fallback=safeImage(img.dataset.fallbackSrc);
  if(!fallback)continue;
  const recover=()=>{
   // Do not retry recursively if the alternative also fails.
   if(img.src!==fallback)img.src=fallback;
  };
  img.addEventListener('error',recover);
  // A cached failure may have happened before the script initialized.
  if(img.complete&&!img.naturalWidth&&img.getAttribute('src'))recover();
 }
}
