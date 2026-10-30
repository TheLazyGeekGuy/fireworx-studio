/** Public assets and the offline worker belong to the project root, not /editor/.
 * Works at / and /repository/ without hard-coding the hosting origin.
 */
export function deploymentBase(href: string = location.href) {
  const url=new URL(href)
  url.pathname=url.pathname.replace(/\/editor(?:\/index\.html)?\/?$/,'/')
  url.search='';url.hash=''
  return new URL('./',url)
}
export function publicAsset(path: string) {
  return typeof location==='undefined'?path:new URL(path,deploymentBase()).href
}
