/* Demo / fallback photos — plain image files in /images (nothing embedded in the code).
   Real product photos live in Supabase Storage (bucket product-images), catalogued in table product_images. */
const PHOTO=(()=>{const base=(typeof location!=="undefined"&&/\/seller\//.test(location.pathname)?"../":"")+"images/",o={};
 ["vase","lamp","throw","mug","candle","plant","pillow","basket","hero"].forEach(k=>o[k]=base+k+".webp");return o})();
