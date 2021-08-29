const csv = require('csv')
const fs = require('fs')

;(async () => { fs.writeFileSync('wc.csv', create_WC_CSV(await read_IMDB_CSV()), {encoding:'utf8'}) })()

async function read_IMDB_CSV() {
  return new Promise((resolve, reject) => {
    const thing = fs.readFileSync('imdb.csv', {encoding:'utf8'})
    csv.parse(thing, {
      columns: true
    }, function(err, output){
      if (err) throw err
      resolve(output)
    })
  })
}

function create_WC_CSV(arr) {
  // start IDs at 11. why? I dont fucking know why
  let csv = setHeader()
  for (let i = 0; i < arr.length; i++) {
    const row = setRow(i, arr[i])
    csv += `${row}\n`
  }
  return csv
}

// TODO: escape commas, replace double quotes with single
function cleanValue(text) {
  if (!text || !text.length) return text
  if (text.includes(',')) return `"${text}"`
  return text
}

function setRow(i, obj) {
  const baseId = 11
  let row ='';let id =baseId+i;let type='simple';let sku=getSku(obj);let name =cleanValue(obj.Title);
  let isPublished='1';let isFeatured='0';let catalogVisibility ='visible';let shortDesc='';
  let desc=cleanValue(obj.Description);let dateSalePriceStart='';let dateSalePriceEnd='';
  let taxStatus='taxable';let taxClass='';let inStock='1';let stock='';let lowStockAmount='';
  let canBackorder='0';let soldIndividually='0';let weight='1';let length='1';let width='1';
  let height='1';let allowCustReview='0';purchaseNote='';salePrice='';regularPrice='9.95';
  let categories='Uncategorized';let tags='';let shippingClass='';let images='';let dlLimit='';
  let dlExpiryDays='';let parent='';let groupedProducts='';let upSells='';let crossSells='';
  let externalUrl='';let buttonTxt='';let position='0';
  let attr1Name='Genres';let attr1Val=cleanValue(obj.Genres);let attr1Vis='1';attr1Global='0';
  let attr2Name='Stars';let attr2Val=cleanValue(obj.Stars);let attr2Vis='1';attr2Global='0';
  let attr3Name='Parental Rating';let attr3Val=obj.ParentalRating;let attr3Vis='1';attr3Global='0';
  let attr4Name='Release Year';let attr4Val=obj.ReleaseYear;let attr4Vis='1';attr4Global='0';
  let attr5Name='Runtime';let attr5Val=obj.Runtime;let attr5Vis='1';attr5Global='0';
  row += `${id},${type},${sku},${name},${isPublished},${isFeatured},${catalogVisibility},`
  row += `${shortDesc},${desc},${dateSalePriceStart},${dateSalePriceEnd},${taxStatus},`
  row += `${taxClass},${inStock},${stock},${lowStockAmount},${canBackorder},${soldIndividually},`
  row += `${weight},${length},${width},${height},${allowCustReview},${purchaseNote},`
  row += `${salePrice},${regularPrice},${categories},${tags},${shippingClass},${images},`
  row += `${dlLimit},${dlExpiryDays},${parent},${groupedProducts},${upSells},${crossSells},`
  row += `${externalUrl},${buttonTxt},${position},`
  row += `${attr1Name},${attr1Val},${attr1Vis},${attr1Global},`
  row += `${attr2Name},${attr2Val},${attr2Vis},${attr2Global},`
  row += `${attr3Name},${attr3Val},${attr3Vis},${attr3Global},`
  row += `${attr4Name},${attr4Val},${attr4Vis},${attr4Global},`
  row += `${attr5Name},${attr5Val},${attr5Vis},${attr5Global}`
  console.log(row)
  return row
}

function setHeader() {
  let header = ''
  header += 'ID,Type,SKU,Published,"Is featured?","Visibility in catalog",'
  header += '"Short description",Description,"Date sale price starts",'
  header += '"Date sale price ends","Tax status","Tax class","In stock?",Stock,'
  header += '"Low stock amount","Backorders allowed?","Sold individually?",'
  header += '"Weight (kg)","Length (cm)","Width (cm)","Height (cm)",'
  header += '"Allow customer reviews?","Purchase note","Sale price","Regular price",'
  header += 'Categories,Tags,"Shipping class",Images,"Download limit",'
  header += '"Download expiry days",Parent,"Grouped products",Upsells,Cross-sells,'
  header += '"External URL","Button text",Position,'
  // attribute shit
  header += '"Attribute 1 name","Attribute 1 value(s)","Attribute 1 visible","Attribute 1 global",'
  header += '"Attribute 2 name","Attribute 2 value(s)","Attribute 2 visible","Attribute 2 global",'
  header += '"Attribute 3 name","Attribute 3 value(s)","Attribute 3 visible","Attribute 3 global",'
  header += '"Attribute 4 name","Attribute 4 value(s)","Attribute 4 visible","Attribute 4 global",'
  header += '"Attribute 5 name","Attribute 5 value(s)","Attribute 5 visible","Attribute 5 global",'
  header += '"Attribute 6 name","Attribute 6 value(s)","Attribute 6 visible","Attribute 6 global"\n'
  return header
}

function getSku(obj) {
  let sku = ''
  obj.Title.split(' ').forEach(w => {
    if (w.length) sku += w[0]
  })
  if (obj.Type === "Movie") sku += 'MV'
  else if (obj.Type === 'TV Series') sku += `TVS${obj.Season}`
  else throw `unknown type ${obj.Type}`
  sku += obj.ReleaseYear//.substring(2)
  sku += 'DVD'
  return sku
}
