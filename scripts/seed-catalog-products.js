import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(dir, '../.env'), 'utf8')
    .split(/\r?\n/)
    .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = getFirestore();
const hash = text => crypto.createHash('sha256').update(String(text).toLowerCase().trim()).digest('hex');

const itemsToSeed = [
  // ===================== CLOTHES =====================
  {
    id: 'bog_prod_tshirt_black_oversized',
    name: 'Premium Oversized Heavyweight Tee',
    slug: 'premium-oversized-heavyweight-tee',
    sku: 'BOG-TS-OVS-BLK',
    category: 'T-Shirts',
    subCategory: 'Oversized',
    price: 999,
    mrp: 1499,
    image: '/images/product-tshirt-black.png',
    colors: [{ name: 'Black', hex: '#000000' }],
    primaryColor: 'Black',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    stockPerVariant: 15,
    shortDescription: '240 GSM combed cotton luxury oversized drop-shoulder t-shirt.',
    description: 'Crafted from heavyweight 240 GSM 100% bio-washed cotton, designed with a contemporary boxy drop-shoulder silhouette, ribbed crew neckline, and double-needle stitching for lasting shape.'
  },
  {
    id: 'bog_prod_tshirt_white_crew',
    name: 'Essential Supima Crew Neck Tee',
    slug: 'essential-supima-crew-neck-tee',
    sku: 'BOG-TS-CRW-WHT',
    category: 'T-Shirts',
    subCategory: 'Regular Fit',
    price: 799,
    mrp: 1299,
    image: '/images/product-tshirt-white.png',
    colors: [{ name: 'White', hex: '#FFFFFF' }],
    primaryColor: 'White',
    sizes: ['S', 'M', 'L', 'XL'],
    stockPerVariant: 18,
    shortDescription: 'Ultra-soft everyday Supima cotton crew neck tee.',
    description: 'The foundation of any modern wardrobe. Breathable, pre-shrunk combed cotton with a tailored regular cut that maintains softness wash after wash.'
  },
  {
    id: 'bog_prod_tshirt_acid_wash',
    name: 'Vintage Acid Wash Graphic Tee',
    slug: 'vintage-acid-wash-graphic-tee',
    sku: 'BOG-TS-ACD-GRY',
    category: 'T-Shirts',
    subCategory: 'Acid Wash',
    price: 899,
    mrp: 1399,
    image: '/images/category-rail/tshirts-cutout.jpg',
    colors: [{ name: 'Grey', hex: '#6B7280' }, { name: 'Black', hex: '#000000' }],
    primaryColor: 'Grey',
    sizes: ['M', 'L', 'XL'],
    stockPerVariant: 12,
    shortDescription: 'Custom mineral acid wash oversized tee with urban streetwear aesthetics.',
    description: 'Each piece features an individually distressed mineral wash treatment giving it an authentic vintage retro vibe. 220 GSM breathable single jersey cotton.'
  },
  {
    id: 'bog_prod_shirt_blue_oxford',
    name: 'Oxford Button-Down Slim Shirt',
    slug: 'oxford-button-down-slim-shirt',
    sku: 'BOG-SH-OXF-BLU',
    category: 'Shirts',
    subCategory: 'Oxford',
    price: 1599,
    mrp: 2199,
    image: '/images/product-shirt-blue.png',
    colors: [{ name: 'Blue', hex: '#1E40AF' }],
    primaryColor: 'Blue',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    stockPerVariant: 14,
    shortDescription: 'Refined 100% cotton Oxford weave tailored button-down shirt.',
    description: 'Timeless Oxford weave button-down shirt featuring pearlised buttons, structured collar, and a modern slim silhouette perfect for smart casual or boardroom styling.'
  },
  {
    id: 'bog_prod_shirt_linen_mandarin',
    name: 'Mandarin Collar Pure Linen Shirt',
    slug: 'mandarin-collar-pure-linen-shirt',
    sku: 'BOG-SH-LIN-WHT',
    category: 'Shirts',
    subCategory: 'Linen',
    price: 1699,
    mrp: 2499,
    image: '/images/category-rail/shirts-cutout-v2.jpg',
    colors: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Olive', hex: '#556B2F' }],
    primaryColor: 'White',
    sizes: ['M', 'L', 'XL', 'XXL'],
    stockPerVariant: 10,
    shortDescription: 'Airy French linen shirt with relaxed band mandarin collar.',
    description: 'Woven from premium European flax linen for superior cooling and breathability. Styled with an effortless mandarin collar and curved hem.'
  },
  {
    id: 'bog_prod_kurta_lakhnavi_chikankari',
    name: 'Royal Lakhnavi Chikankari Kurta',
    slug: 'royal-lakhnavi-chikankari-kurta',
    sku: 'BOG-ET-LAKH-BEI',
    category: 'Kurta',
    subCategory: 'Lakhnavi Kurta',
    price: 1899,
    mrp: 2999,
    image: '/images/category-rail/kurta-cutout.jpg',
    colors: [{ name: 'Beige', hex: '#D6C3A1' }, { name: 'White', hex: '#FFFFFF' }],
    primaryColor: 'Beige',
    sizes: ['38', '40', '42', '44'],
    stockPerVariant: 10,
    shortDescription: 'Intricately hand-embroidered Lakhnavi Chikankari cotton kurta.',
    description: 'Authentic handcrafted Chikankari floral motifs with sequence work on fine soft cotton fabric. Ideal for weddings, festivals, and celebratory occasions.'
  },
  {
    id: 'bog_prod_kurta_festive_bandhani',
    name: 'Festive Bandhani Silk Blend Kurta',
    slug: 'festive-bandhani-silk-blend-kurta',
    sku: 'BOG-ET-BAND-MAR',
    category: 'Ethnic Wear',
    subCategory: 'Bandhani Kurta',
    price: 2199,
    mrp: 3499,
    image: '/images/category-rail/ethnic-wear-cutout.jpg',
    colors: [{ name: 'Maroon', hex: '#800020' }, { name: 'Mustard', hex: '#D97706' }],
    primaryColor: 'Maroon',
    sizes: ['38', '40', '42', '44'],
    stockPerVariant: 8,
    shortDescription: 'Traditional royal Bandhani print silk blend celebratory kurta.',
    description: 'Vibrant traditional Bandhani pattern on a luxurious silk-cotton blend with mandarin collar and side slits for distinguished elegance.'
  },
  {
    id: 'bog_prod_jeans_dark_wash',
    name: 'Slim Fit Dark Wash Stretch Jeans',
    slug: 'slim-fit-dark-wash-stretch-jeans',
    sku: 'BOG-JN-SLM-DNM',
    category: 'Jeans',
    subCategory: 'Slim Fit',
    price: 1899,
    mrp: 2699,
    image: '/images/product-jeans-dark.png',
    colors: [{ name: 'Blue', hex: '#1E40AF' }],
    primaryColor: 'Blue',
    sizes: ['30', '32', '34', '36'],
    stockPerVariant: 12,
    shortDescription: 'Durable 12.5 oz power-stretch denim in rich deep indigo wash.',
    description: 'Designed for everyday comfort with 98% cotton and 2% elastane power-stretch denim. Clean dark indigo rinse with reinforced bar-tacks and copper rivets.'
  },
  {
    id: 'bog_prod_jeans_straight_relaxed',
    name: 'Relaxed Straight Fit Vintage Jeans',
    slug: 'relaxed-straight-fit-vintage-jeans',
    sku: 'BOG-JN-STR-BLU',
    category: 'Jeans',
    subCategory: 'Straight Fit',
    price: 1999,
    mrp: 2799,
    image: '/images/category-rail/jeans-cutout.jpg',
    colors: [{ name: 'Blue', hex: '#1E40AF' }],
    primaryColor: 'Blue',
    sizes: ['30', '32', '34', '36', '38'],
    stockPerVariant: 10,
    shortDescription: 'Classic 90s inspired straight leg rigid cotton denim.',
    description: 'Authentic 13 oz ring-spun cotton denim cut in a comfortable straight fit that sits easily through the hip and thigh.'
  },
  {
    id: 'bog_prod_trouser_pleated_chino',
    name: 'Tailored Pleated Chino Trousers',
    slug: 'tailored-pleated-chino-trousers',
    sku: 'BOG-TR-PLT-BEI',
    category: 'Trousers',
    subCategory: 'Chino',
    price: 1499,
    mrp: 2299,
    image: '/images/product-trouser-beige.png',
    colors: [{ name: 'Beige', hex: '#D6C3A1' }],
    primaryColor: 'Beige',
    sizes: ['30', '32', '34', '36'],
    stockPerVariant: 15,
    shortDescription: 'Modern single-pleat stretch cotton twill chino trousers.',
    description: 'Sophisticated single-pleat silhouette tailored from premium combed cotton twill with hidden stretch waistband for supreme all-day comfort.'
  },
  {
    id: 'bog_prod_jacket_bomber_black',
    name: 'Classic Urban Bomber Jacket',
    slug: 'classic-urban-bomber-jacket',
    sku: 'BOG-JK-BOM-BLK',
    category: 'Jackets',
    subCategory: 'Bomber',
    price: 2999,
    mrp: 4499,
    image: '/images/product-jacket-black.png',
    colors: [{ name: 'Black', hex: '#000000' }],
    primaryColor: 'Black',
    sizes: ['M', 'L', 'XL', 'XXL'],
    stockPerVariant: 8,
    shortDescription: 'Weather-resistant lightweight nylon varsity bomber jacket.',
    description: 'High-density matte nylon exterior with silky quilted inner lining, ribbed collar and cuffs, heavy-duty metallic zipper, and interior pocket.'
  },

  // ===================== ACCESSORIES =====================
  {
    id: 'bog_prod_acc_watch_chronograph',
    name: 'Royal Chronograph Black Steel Watch',
    slug: 'royal-chronograph-black-steel-watch',
    sku: 'BOG-ACC-WT-CHR',
    category: 'Watches',
    subCategory: 'Chronograph',
    price: 2499,
    mrp: 3999,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    colors: [{ name: 'Black', hex: '#000000' }],
    primaryColor: 'Black',
    sizes: ['One Size'],
    stockPerVariant: 20,
    shortDescription: 'Stainless steel black chronograph with Japanese quartz movement.',
    description: 'Featuring a 42mm matte black stainless steel case, scratch-resistant sapphire-coated glass, 3-subdial stopwatch chronograph, and 50m water resistance.'
  },
  {
    id: 'bog_prod_acc_watch_silver_analog',
    name: 'Minimalist Silver Analog Watch',
    slug: 'minimalist-silver-analog-watch',
    sku: 'BOG-ACC-WT-SLV',
    category: 'Watches',
    subCategory: 'Analog',
    price: 1899,
    mrp: 2999,
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600',
    colors: [{ name: 'Silver', hex: '#C0C0C0' }],
    primaryColor: 'Silver',
    sizes: ['One Size'],
    stockPerVariant: 15,
    shortDescription: 'Clean brushed stainless steel minimalist dress watch.',
    description: 'Sleek 40mm brushed stainless steel dial with genuine leather strap, sunray dial finish, and ultra-reliable Japanese precision quartz movement.'
  },
  {
    id: 'bog_prod_acc_belt_italian_leather',
    name: 'Italian Reversible Leather Belt',
    slug: 'italian-reversible-leather-belt',
    sku: 'BOG-ACC-BLT-REV',
    category: 'Belts',
    subCategory: 'Reversible',
    price: 1199,
    mrp: 1999,
    image: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600',
    colors: [{ name: 'Brown', hex: '#5C4033' }, { name: 'Black', hex: '#000000' }],
    primaryColor: 'Brown',
    sizes: ['One Size'],
    stockPerVariant: 25,
    shortDescription: 'Handcrafted 100% full-grain leather reversible belt.',
    description: 'Switch seamlessly between rich cognac brown and deep obsidian black with the patented 360-degree rotating zinc alloy buckle. 35mm width.'
  },
  {
    id: 'bog_prod_acc_wallet_rfid_bifold',
    name: 'Slim RFID-Blocking Leather Wallet',
    slug: 'slim-rfid-blocking-leather-wallet',
    sku: 'BOG-ACC-WL-BIF',
    category: 'Wallets',
    subCategory: 'Bifold',
    price: 899,
    mrp: 1499,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600',
    colors: [{ name: 'Tan', hex: '#D2B48C' }],
    primaryColor: 'Tan',
    sizes: ['One Size'],
    stockPerVariant: 30,
    shortDescription: 'Genuine vegetable-tanned leather bifold with RFID shield.',
    description: 'Ultra-slim bifold profile holding up to 8 cards, currency compartment, and quick-access ID slot. Built-in military-grade RFID blocking technology protects cards.'
  },
  {
    id: 'bog_prod_acc_sunglasses_aviator',
    name: 'Classic Polarized Aviator Sunglasses',
    slug: 'classic-polarized-aviator-sunglasses',
    sku: 'BOG-ACC-SG-AVT',
    category: 'Sunglasses',
    subCategory: 'Aviator',
    price: 1499,
    mrp: 2499,
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
    colors: [{ name: 'Gold/Black', hex: '#D4AF37' }],
    primaryColor: 'Gold/Black',
    sizes: ['One Size'],
    stockPerVariant: 20,
    shortDescription: '100% UV400 polarized teardrop aviator sunglasses.',
    description: 'Lightweight corrosion-resistant metallic alloy frame with silicone nose pads and glare-eliminating polarized TAC lenses with full UV400 protection.'
  },
  {
    id: 'bog_prod_acc_sunglasses_wayfarer',
    name: 'Retro Square Polarized Sunglasses',
    slug: 'retro-square-polarized-sunglasses',
    sku: 'BOG-ACC-SG-WAY',
    category: 'Sunglasses',
    subCategory: 'Wayfarer',
    price: 1199,
    mrp: 1999,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600',
    colors: [{ name: 'Black', hex: '#000000' }],
    primaryColor: 'Black',
    sizes: ['One Size'],
    stockPerVariant: 20,
    shortDescription: 'Timeless matte black square frame polarized sunglasses.',
    description: 'Crafted from durable lightweight polycarbonate with reinforced 5-barrel hinges and anti-scratch polarized dark smoke lenses.'
  },
  {
    id: 'bog_prod_acc_perfume_royal_oud',
    name: 'Executive Royal Oud Eau De Parfum 100ml',
    slug: 'executive-royal-oud-eau-de-parfum-100ml',
    sku: 'BOG-ACC-PRF-OUD',
    category: 'Perfumes',
    subCategory: 'Eau de Parfum',
    price: 1899,
    mrp: 3299,
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600',
    colors: [{ name: 'Gold', hex: '#D4AF37' }],
    primaryColor: 'Gold',
    sizes: ['100ml'],
    stockPerVariant: 15,
    shortDescription: 'Long-lasting luxury Eau De Parfum with rich notes of Oud & Amber.',
    description: 'An intoxicating fragrance opening with spicy bergamot and saffron, transitioning into a heart of smoky Cambodian oud, and settling into warm vanilla and amber.'
  },
  {
    id: 'bog_prod_acc_cap_snapback',
    name: 'Urban Embroidered Snapback Cap',
    slug: 'urban-embroidered-snapback-cap',
    sku: 'BOG-ACC-CP-SNP',
    category: 'Caps',
    subCategory: 'Snapback',
    price: 699,
    mrp: 1199,
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600',
    colors: [{ name: 'Black', hex: '#000000' }],
    primaryColor: 'Black',
    sizes: ['Adjustable'],
    stockPerVariant: 25,
    shortDescription: 'Premium structured 6-panel snapback with 3D embroidery.',
    description: '100% cotton twill structured front panels, flat visor with 8 rows of stitching, embroidered eyelets for airflow, and classic adjustable snap closure.'
  }
];

async function seed() {
  console.log(`Preparing to seed ${itemsToSeed.length} products...`);
  const apply = process.argv.includes('--apply');

  const batch = db.batch();
  let writeCount = 0;

  for (const item of itemsToSeed) {
    const docRef = db.collection('products').doc(item.id);

    const variants = [];
    item.sizes.forEach((size, sIdx) => {
      item.colors.forEach((col, cIdx) => {
        const sizeKey = String(size).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const colKey = String(col.name).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const vSku = `${item.sku}-${sizeKey}-${colKey}`;
        variants.push({
          id: `${item.id}-v${sIdx + 1}-${cIdx + 1}`,
          sku: vSku,
          size: String(size),
          color: col.name,
          stock: item.stockPerVariant,
          quantity: item.stockPerVariant,
          reserved: 0,
          price: item.price,
          salePrice: item.price,
          costPrice: Math.round(item.price * 0.45),
          cost_price: Math.round(item.price * 0.45),
          isDefaultPrice: sIdx === 0 && cIdx === 0
        });
      });
    });

    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);

    const productDoc = {
      id: item.id,
      webProductId: item.id,
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      category: item.category,
      categoryId: item.category,
      subCategory: item.subCategory,
      shortDescription: item.shortDescription,
      description: item.description,
      price: item.price,
      salePrice: item.price,
      mrp: item.mrp,
      compareAtPrice: item.mrp,
      discountPercentage: discount,
      colors: item.colors,
      primaryColor: item.primaryColor,
      variants,
      sizes: item.sizes,
      allSizes: item.sizes,
      stock: totalStock,
      quantity: totalStock,
      reserved: 0,
      inStock: true,
      active: true,
      isDeleted: false,
      isTrending: true,
      offerEnabled: false,
      gstEnabled: true,
      gstPercent: 5,
      rating: 4.7,
      images: [
        { url: item.image, isPrimary: true, sortOrder: 0, alt: item.name }
      ],
      image: item.image,
      thumbnailUrl: item.image,
      integrationOrigin: 'website',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      integrationCreatedAt: FieldValue.serverTimestamp()
    };

    batch.set(docRef, productDoc, { merge: true });
    writeCount++;

    // Slug mapping
    const slugDocRef = db.collection('productSlugMappings').doc(hash(item.slug));
    batch.set(slugDocRef, {
      normalizedSlug: item.slug.toLowerCase(),
      slug: item.slug,
      productId: item.id,
      webProductId: item.id,
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writeCount++;

    // Parent SKU mapping
    const parentSkuDocRef = db.collection('productSkuMappings').doc(hash(item.sku));
    batch.set(parentSkuDocRef, {
      normalizedSku: item.sku.toLowerCase(),
      sku: item.sku,
      productId: item.id,
      webProductId: item.id,
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writeCount++;

    // Variant SKU mappings
    for (const v of variants) {
      const vSkuDocRef = db.collection('productSkuMappings').doc(hash(v.sku));
      batch.set(vSkuDocRef, {
        normalizedSku: v.sku.toLowerCase(),
        sku: v.sku,
        productId: item.id,
        webProductId: item.id,
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      writeCount++;
    }
  }

  console.log(`Generated batch operations count: ${writeCount}`);
  if (apply) {
    await batch.commit();
    console.log(`Successfully committed ${itemsToSeed.length} active products to Firestore!`);
  } else {
    console.log(`Dry run complete. Run with --apply to commit to Firestore.`);
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
