"use strict";
// Quebec Business Detection System
// Comprehensive database of Quebec businesses with smart detection
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCategories = exports.getCategoryById = exports.detectBusinessType = exports.BUSINESS_CATEGORIES = void 0;
// Business categories (updated with comprehensive dataset)
exports.BUSINESS_CATEGORIES = [
    {
        id: 'grocery',
        name: 'Grocery / Supermarket',
        icon: '🛒',
        color: '#10B981',
        mapColor: '#10B981' // Use category color for clusters
    },
    {
        id: 'coffee',
        name: 'Coffee / Café',
        icon: '☕️',
        color: '#92400E',
        mapColor: '#92400E'
    },
    {
        id: 'pharmacy',
        name: 'Pharmacy / Drugstore',
        icon: '💊',
        color: '#DC2626',
        mapColor: '#DC2626'
    },
    {
        id: 'gym',
        name: 'Gym / Fitness / Sports',
        icon: '🏋️',
        color: '#7C3AED',
        mapColor: '#7C3AED'
    },
    {
        id: 'restaurant',
        name: 'Restaurant / Fast Food',
        icon: '🍔',
        color: '#B45309',
        mapColor: '#B45309'
    },
    {
        id: 'convenience',
        name: 'Convenience Store / Dépanneur',
        icon: '🏪',
        color: '#7C2D12',
        mapColor: '#7C2D12'
    },
    {
        id: 'bakery',
        name: 'Bakery / Pâtisserie',
        icon: '🥐',
        color: '#D97706',
        mapColor: '#D97706'
    },
    {
        id: 'bar',
        name: 'Bar / Pub / Nightlife',
        icon: '🍺',
        color: '#059669',
        mapColor: '#059669'
    },
    {
        id: 'shopping',
        name: 'Shopping / Clothing / Retail',
        icon: '👗',
        color: '#EC4899',
        mapColor: '#EC4899'
    },
    {
        id: 'bank',
        name: 'Bank / ATM / Finance',
        icon: '🏦',
        color: '#1E40AF',
        mapColor: '#1E40AF'
    },
    {
        id: 'hotel',
        name: 'Hotel / Accommodation',
        icon: '🏨',
        color: '#0F766E',
        mapColor: '#0F766E'
    },
    {
        id: 'gas',
        name: 'Gas Station / Car Service',
        icon: '⛽️',
        color: '#EA580C',
        mapColor: '#EA580C'
    },
    {
        id: 'hospital',
        name: 'Hospital / Clinic / Dentist',
        icon: '🏥',
        color: '#059669',
        mapColor: '#059669'
    },
    {
        id: 'school',
        name: 'School / University',
        icon: '🎓',
        color: '#7C2D12',
        mapColor: '#7C2D12'
    },
    {
        id: 'library',
        name: 'Library / Bookstore',
        icon: '📚',
        color: '#1F2937',
        mapColor: '#1F2937'
    },
    {
        id: 'park',
        name: 'Park / Nature / Trail',
        icon: '🌳',
        color: '#16A34A',
        mapColor: '#16A34A'
    },
    {
        id: 'transportation',
        name: 'Airport / Transportation',
        icon: '✈️',
        color: '#2563EB',
        mapColor: '#2563EB'
    },
    {
        id: 'organic_grocery',
        name: 'Organic Grocery / Bio',
        icon: '🥦',
        color: '#16A34A',
        mapColor: '#16A34A'
    },
    {
        id: 'herbal_shop',
        name: 'Herbal Shop / Herboristerie',
        icon: '🌿',
        color: '#059669',
        mapColor: '#059669'
    },
    {
        id: 'health_cafe',
        name: 'Health Café / Café Santé',
        icon: '☕️',
        color: '#92400E',
        mapColor: '#92400E'
    },
    {
        id: 'farmers_market',
        name: 'Farmers Market / Marché Fermier',
        icon: '🍯',
        color: '#D97706',
        mapColor: '#D97706'
    },
    {
        id: 'other',
        name: 'Other',
        icon: '📍',
        color: '#6B7280',
        mapColor: '#6B7280'
    }
];
// Comprehensive business database
const QUEBEC_BUSINESSES = {
    // Grocery / Supermarket
    'iga': { category: 'grocery', confidence: 95 },
    'metro': { category: 'grocery', confidence: 95 },
    'super c': { category: 'grocery', confidence: 95 },
    'provigo': { category: 'grocery', confidence: 95 },
    'maxi': { category: 'grocery', confidence: 95 },
    'costco': { category: 'grocery', confidence: 95 },
    'walmart': { category: 'grocery', confidence: 95 },
    'loblaws': { category: 'grocery', confidence: 95 },
    'sobeys': { category: 'grocery', confidence: 90 },
    'safeway': { category: 'grocery', confidence: 90 },
    'food basics': { category: 'grocery', confidence: 90 },
    'trader joes': { category: 'grocery', confidence: 90 },
    'kroger': { category: 'grocery', confidence: 90 },
    'publix': { category: 'grocery', confidence: 90 },
    'aldi': { category: 'grocery', confidence: 90 },
    'carrefour': { category: 'grocery', confidence: 90 },
    'tesco': { category: 'grocery', confidence: 90 },
    'lidl': { category: 'grocery', confidence: 90 },
    'super u': { category: 'grocery', confidence: 90 },
    'no frills': { category: 'grocery', confidence: 90 },
    'foodland': { category: 'grocery', confidence: 90 },
    'freshco': { category: 'grocery', confidence: 90 },
    'target': { category: 'grocery', confidence: 90 },
    'sams club': { category: 'grocery', confidence: 90 },
    'food 4 less': { category: 'grocery', confidence: 90 },
    'real canadian superstore': { category: 'grocery', confidence: 90 },
    'marché adonis': { category: 'grocery', confidence: 90 },
    'tt supermarket': { category: 'grocery', confidence: 90 },
    'intermarché': { category: 'grocery', confidence: 90 },
    'auchan': { category: 'grocery', confidence: 90 },
    'eleclerc': { category: 'grocery', confidence: 90 },
    'sainsburys': { category: 'grocery', confidence: 90 },
    'waitrose': { category: 'grocery', confidence: 90 },
    // Coffee / Café
    'starbucks': { category: 'coffee', confidence: 95 },
    'tim hortons': { category: 'coffee', confidence: 95 },
    'second cup': { category: 'coffee', confidence: 95 },
    'café van houtte': { category: 'coffee', confidence: 95 },
    'presse café': { category: 'coffee', confidence: 95 },
    'dunkin': { category: 'coffee', confidence: 95 },
    'peets coffee': { category: 'coffee', confidence: 95 },
    'coffee bean & tea leaf': { category: 'coffee', confidence: 95 },
    'caffè nero': { category: 'coffee', confidence: 95 },
    'costa coffee': { category: 'coffee', confidence: 95 },
    'mccafé': { category: 'coffee', confidence: 95 },
    'gloria jeans': { category: 'coffee', confidence: 95 },
    'café dépôt': { category: 'coffee', confidence: 95 },
    'café olimpico': { category: 'coffee', confidence: 95 },
    'café st-henri': { category: 'coffee', confidence: 95 },
    'café riccardo': { category: 'coffee', confidence: 95 },
    'bridgehead': { category: 'coffee', confidence: 95 },
    'balzacs coffee roasters': { category: 'coffee', confidence: 95 },
    // Pharmacy / Drugstore
    'jean coutu': { category: 'pharmacy', confidence: 95 },
    'jean-coutu': { category: 'pharmacy', confidence: 95 },
    'jc': { category: 'pharmacy', confidence: 95 },
    'pharmaprix': { category: 'pharmacy', confidence: 95 },
    'shoppers drug mart': { category: 'pharmacy', confidence: 95 },
    'uniprix': { category: 'pharmacy', confidence: 95 },
    'upx': { category: 'pharmacy', confidence: 95 },
    'familiprix': { category: 'pharmacy', confidence: 95 },
    'fm': { category: 'pharmacy', confidence: 95 },
    'brunet': { category: 'pharmacy', confidence: 95 },
    'rexall': { category: 'pharmacy', confidence: 95 },
    'guardian': { category: 'pharmacy', confidence: 95 },
    'london drugs': { category: 'pharmacy', confidence: 95 },
    'walgreens': { category: 'pharmacy', confidence: 95 },
    'cvs pharmacy': { category: 'pharmacy', confidence: 95 },
    'boots': { category: 'pharmacy', confidence: 95 },
    'watsons': { category: 'pharmacy', confidence: 95 },
    'wellca': { category: 'pharmacy', confidence: 95 },
    'dis-chem': { category: 'pharmacy', confidence: 95 },
    'apotex': { category: 'pharmacy', confidence: 95 },
    'pharmachoice': { category: 'pharmacy', confidence: 95 },
    // Gym / Fitness / Sports
    'éconofitness': { category: 'gym', confidence: 95 },
    'econofitness': { category: 'gym', confidence: 95 },
    'goodlife fitness': { category: 'gym', confidence: 95 },
    'anytime fitness': { category: 'gym', confidence: 95 },
    'planet fitness': { category: 'gym', confidence: 95 },
    'orangetheory fitness': { category: 'gym', confidence: 95 },
    'ymca': { category: 'gym', confidence: 95 },
    'nautilus plus': { category: 'gym', confidence: 95 },
    'golds gym': { category: 'gym', confidence: 95 },
    'crunch fitness': { category: 'gym', confidence: 95 },
    'énergie cardio': { category: 'gym', confidence: 95 },
    'crossfit': { category: 'gym', confidence: 95 },
    'la fitness': { category: 'gym', confidence: 95 },
    'snap fitness': { category: 'gym', confidence: 95 },
    'club sportif maa': { category: 'gym', confidence: 95 },
    'f45 training': { category: 'gym', confidence: 95 },
    'equinox': { category: 'gym', confidence: 95 },
    '24 hour fitness': { category: 'gym', confidence: 95 },
    'fitplus': { category: 'gym', confidence: 95 },
    'world gym': { category: 'gym', confidence: 95 },
    'econo gym': { category: 'gym', confidence: 95 },
    'curves': { category: 'gym', confidence: 95 },
    // Restaurant / Fast Food
    'mcdonalds': { category: 'restaurant', confidence: 95 },
    'burger king': { category: 'restaurant', confidence: 95 },
    'aw': { category: 'restaurant', confidence: 95 },
    'harveys': { category: 'restaurant', confidence: 95 },
    'wendys': { category: 'restaurant', confidence: 95 },
    'subway': { category: 'restaurant', confidence: 95 },
    'kfc': { category: 'restaurant', confidence: 95 },
    'pfk': { category: 'restaurant', confidence: 95 },
    'pizza hut': { category: 'restaurant', confidence: 95 },
    'dominos': { category: 'restaurant', confidence: 95 },
    'popeyes': { category: 'restaurant', confidence: 95 },
    'taco bell': { category: 'restaurant', confidence: 95 },
    'chipotle': { category: 'restaurant', confidence: 95 },
    'nandos': { category: 'restaurant', confidence: 95 },
    'boston pizza': { category: 'restaurant', confidence: 95 },
    'st-hubert': { category: 'restaurant', confidence: 95 },
    'la belle & la bœuf': { category: 'restaurant', confidence: 95 },
    'montanas': { category: 'restaurant', confidence: 95 },
    'scores': { category: 'restaurant', confidence: 95 },
    'benny & co': { category: 'restaurant', confidence: 95 },
    'dennys': { category: 'restaurant', confidence: 95 },
    'chilis': { category: 'restaurant', confidence: 95 },
    'five guys': { category: 'restaurant', confidence: 95 },
    'shake shack': { category: 'restaurant', confidence: 95 },
    'olive garden': { category: 'restaurant', confidence: 95 },
    'pizza pizza': { category: 'restaurant', confidence: 95 },
    'la belle province': { category: 'restaurant', confidence: 95 },
    // Convenience Store / Dépanneur
    'couche-tard': { category: 'convenience', confidence: 95 },
    '7-eleven': { category: 'convenience', confidence: 95 },
    'shell select': { category: 'convenience', confidence: 95 },
    'on the run': { category: 'convenience', confidence: 95 },
    // Bakery / Pâtisserie
    'au pain doré': { category: 'bakery', confidence: 95 },
    'première moisson': { category: 'bakery', confidence: 95 },
    'bennys bakery': { category: 'bakery', confidence: 95 },
    'pa boulangerie': { category: 'bakery', confidence: 95 },
    'la baguette': { category: 'bakery', confidence: 95 },
    'cobs bread': { category: 'bakery', confidence: 95 },
    'panera bread': { category: 'bakery', confidence: 95 },
    'paul': { category: 'bakery', confidence: 95 },
    'le pain quotidien': { category: 'bakery', confidence: 95 },
    'boulangerie ange': { category: 'bakery', confidence: 95 },
    // Bar / Pub / Nightlife
    'les 3 brasseurs': { category: 'bar', confidence: 95 },
    'archibald': { category: 'bar', confidence: 95 },
    'saint-bock': { category: 'bar', confidence: 95 },
    'baton rouge': { category: 'bar', confidence: 95 },
    'milestones': { category: 'bar', confidence: 95 },
    'jack astors': { category: 'bar', confidence: 95 },
    'irish pub': { category: 'bar', confidence: 95 },
    'brewdog': { category: 'bar', confidence: 95 },
    'heineken bar': { category: 'bar', confidence: 95 },
    'hoegaarden pub': { category: 'bar', confidence: 95 },
    // Shopping / Clothing / Retail
    'winners': { category: 'shopping', confidence: 95 },
    'marshalls': { category: 'shopping', confidence: 95 },
    'hudsons bay': { category: 'shopping', confidence: 95 },
    'la baie': { category: 'shopping', confidence: 95 },
    'simons': { category: 'shopping', confidence: 95 },
    'hm': { category: 'shopping', confidence: 95 },
    'zara': { category: 'shopping', confidence: 95 },
    'uniqlo': { category: 'shopping', confidence: 95 },
    'old navy': { category: 'shopping', confidence: 95 },
    'gap': { category: 'shopping', confidence: 95 },
    'aritzia': { category: 'shopping', confidence: 95 },
    'ardene': { category: 'shopping', confidence: 95 },
    'sport chek': { category: 'shopping', confidence: 95 },
    'lululemon': { category: 'shopping', confidence: 95 },
    'decathlon': { category: 'shopping', confidence: 95 },
    'roots': { category: 'shopping', confidence: 95 },
    'nike': { category: 'shopping', confidence: 95 },
    'adidas': { category: 'shopping', confidence: 95 },
    'under armour': { category: 'shopping', confidence: 95 },
    'reitmans': { category: 'shopping', confidence: 95 },
    'le château': { category: 'shopping', confidence: 95 },
    // Bank / ATM / Finance
    'rbc': { category: 'bank', confidence: 95 },
    'td': { category: 'bank', confidence: 95 },
    'scotiabank': { category: 'bank', confidence: 95 },
    'bmo': { category: 'bank', confidence: 95 },
    'cibc': { category: 'bank', confidence: 95 },
    'desjardins': { category: 'bank', confidence: 95 },
    'national bank': { category: 'bank', confidence: 95 },
    'laurentian bank': { category: 'bank', confidence: 95 },
    'hsbc': { category: 'bank', confidence: 95 },
    'capital one': { category: 'bank', confidence: 95 },
    'chase': { category: 'bank', confidence: 95 },
    'wells fargo': { category: 'bank', confidence: 95 },
    'bank of america': { category: 'bank', confidence: 95 },
    'citibank': { category: 'bank', confidence: 95 },
    'santander': { category: 'bank', confidence: 95 },
    'barclays': { category: 'bank', confidence: 95 },
    // Hotel / Accommodation
    'hilton': { category: 'hotel', confidence: 95 },
    'marriott': { category: 'hotel', confidence: 95 },
    'best western': { category: 'hotel', confidence: 95 },
    'holiday inn': { category: 'hotel', confidence: 95 },
    'fairmont': { category: 'hotel', confidence: 95 },
    'days inn': { category: 'hotel', confidence: 95 },
    'comfort inn': { category: 'hotel', confidence: 95 },
    'super 8': { category: 'hotel', confidence: 95 },
    'motel 6': { category: 'hotel', confidence: 95 },
    'sheraton': { category: 'hotel', confidence: 95 },
    'four seasons': { category: 'hotel', confidence: 95 },
    'hôtel le germain': { category: 'hotel', confidence: 95 },
    'delta hotels': { category: 'hotel', confidence: 95 },
    'hyatt': { category: 'hotel', confidence: 95 },
    'novotel': { category: 'hotel', confidence: 95 },
    'ibis': { category: 'hotel', confidence: 95 },
    // Gas Station / Car Service
    'shell': { category: 'gas', confidence: 95 },
    'esso': { category: 'gas', confidence: 95 },
    'petro-canada': { category: 'gas', confidence: 95 },
    'ultramar': { category: 'gas', confidence: 95 },
    'irving': { category: 'gas', confidence: 95 },
    'chevron': { category: 'gas', confidence: 95 },
    'mobil': { category: 'gas', confidence: 95 },
    'total': { category: 'gas', confidence: 95 },
    'bp': { category: 'gas', confidence: 95 },
    'texaco': { category: 'gas', confidence: 95 },
    'circle k': { category: 'gas', confidence: 95 },
    // Hospital / Clinic / Dentist
    'chum': { category: 'hospital', confidence: 95 },
    'cusm': { category: 'hospital', confidence: 95 },
    'mayo clinic': { category: 'hospital', confidence: 95 },
    'cleveland clinic': { category: 'hospital', confidence: 95 },
    'sunnybrook': { category: 'hospital', confidence: 95 },
    'hôpital sainte-justine': { category: 'hospital', confidence: 95 },
    'clinique dentaire': { category: 'hospital', confidence: 95 },
    'medisys': { category: 'hospital', confidence: 95 },
    'rockland md': { category: 'hospital', confidence: 95 },
    // School / University
    'université de montréal': { category: 'school', confidence: 95 },
    'mcgill': { category: 'school', confidence: 95 },
    'concordia': { category: 'school', confidence: 95 },
    'polytechnique montréal': { category: 'school', confidence: 95 },
    'hec montréal': { category: 'school', confidence: 95 },
    'université laval': { category: 'school', confidence: 95 },
    'uqam': { category: 'school', confidence: 95 },
    'université de sherbrooke': { category: 'school', confidence: 95 },
    'harvard': { category: 'school', confidence: 95 },
    'mit': { category: 'school', confidence: 95 },
    'stanford': { category: 'school', confidence: 95 },
    'uoft': { category: 'school', confidence: 95 },
    'ubc': { category: 'school', confidence: 95 },
    // Library / Bookstore
    'renaud-bray': { category: 'library', confidence: 95 },
    'indigo': { category: 'library', confidence: 95 },
    'chapters': { category: 'library', confidence: 95 },
    'archambault': { category: 'library', confidence: 95 },
    'amazon books': { category: 'library', confidence: 95 },
    'waterstones': { category: 'library', confidence: 95 },
    'fnac': { category: 'library', confidence: 95 },
    'barnes & noble': { category: 'library', confidence: 95 },
    // Park / Nature / Trail
    'parc du mont-orford': { category: 'park', confidence: 95 },
    'parc de la mauricie': { category: 'park', confidence: 95 },
    'yosemite': { category: 'park', confidence: 95 },
    'banff': { category: 'park', confidence: 95 },
    'parc lafontaine': { category: 'park', confidence: 95 },
    'parc mont-royal': { category: 'park', confidence: 95 },
    'jasper': { category: 'park', confidence: 95 },
    'yellowstone': { category: 'park', confidence: 95 },
    // Airport / Transportation
    'yul': { category: 'transportation', confidence: 95 },
    'yyz': { category: 'transportation', confidence: 95 },
    'yvr': { category: 'transportation', confidence: 95 },
    'air canada': { category: 'transportation', confidence: 95 },
    'westjet': { category: 'transportation', confidence: 95 },
    'porter': { category: 'transportation', confidence: 95 },
    'united airlines': { category: 'transportation', confidence: 95 },
    'delta': { category: 'transportation', confidence: 95 },
    'air france': { category: 'transportation', confidence: 95 },
    'lufthansa': { category: 'transportation', confidence: 95 },
    'via rail': { category: 'transportation', confidence: 95 },
    'amtrak': { category: 'transportation', confidence: 95 },
    // Organic Grocery / Bio
    'avril': { category: 'organic_grocery', confidence: 95 },
    'rachelle béry': { category: 'organic_grocery', confidence: 95 },
    'la moisson': { category: 'organic_grocery', confidence: 95 },
    'whole foods': { category: 'organic_grocery', confidence: 95 },
    'biocoop': { category: 'organic_grocery', confidence: 95 },
    'naturalia': { category: 'organic_grocery', confidence: 95 },
    'bulk barn': { category: 'organic_grocery', confidence: 90 },
    'zero waste': { category: 'organic_grocery', confidence: 90 },
    // Herbal Shop / Herboristerie
    'herboristerie la maria': { category: 'herbal_shop', confidence: 95 },
    'gaia herbs': { category: 'herbal_shop', confidence: 95 },
    'new roots herbal': { category: 'herbal_shop', confidence: 95 },
    'herboristerie': { category: 'herbal_shop', confidence: 95 },
    'naturopathie': { category: 'herbal_shop', confidence: 90 },
    'plantes': { category: 'herbal_shop', confidence: 85 },
    'tisanes': { category: 'herbal_shop', confidence: 85 },
    'huiles essentielles': { category: 'herbal_shop', confidence: 85 },
    'suppléments': { category: 'herbal_shop', confidence: 85 },
    // Health Café / Café Santé
    'leaves house': { category: 'health_cafe', confidence: 95 },
    'mandys': { category: 'health_cafe', confidence: 95 },
    'freshii': { category: 'health_cafe', confidence: 95 },
    'booster juice': { category: 'health_cafe', confidence: 95 },
    'bar à jus': { category: 'health_cafe', confidence: 90 },
    'smoothie': { category: 'health_cafe', confidence: 85 },
    'matcha': { category: 'health_cafe', confidence: 85 },
    'kombucha': { category: 'health_cafe', confidence: 85 },
    'vegan': { category: 'health_cafe', confidence: 80 },
    // Farmers Market / Marché Fermier
    'marché jean-talon': { category: 'farmers_market', confidence: 95 },
    'miel danicet': { category: 'farmers_market', confidence: 95 },
    'borough market': { category: 'farmers_market', confidence: 95 },
    'marché fermier': { category: 'farmers_market', confidence: 95 },
    'producteur local': { category: 'farmers_market', confidence: 90 },
    'fromagerie': { category: 'farmers_market', confidence: 85 },
    'miel': { category: 'farmers_market', confidence: 85 },
    'artisanal': { category: 'farmers_market', confidence: 80 }
};
// Comprehensive keyword patterns for category detection (with confidence levels)
const KEYWORD_PATTERNS = {
    grocery: {
        keywords: ['grocery', 'supermarket', 'market', 'food', 'superstore', 'wholesale', 'fresh', 'coop', 'store', 'bazaar', 'mart', 'épicerie', 'fruiterie', 'supermarché', 'alimentation', 'marché', 'coop', 'magasin', 'produits alimentaires'],
        confidence: 90
    },
    coffee: {
        keywords: ['coffee', 'espresso', 'latte', 'brew', 'cappuccino', 'tea', 'barista', 'roaster', 'coffeehouse', 'café', 'thé', 'espresso', 'latte', 'moka', 'brûlerie', 'torréfacteur', 'infusion'],
        confidence: 95
    },
    pharmacy: {
        keywords: ['pharmacy', 'drugstore', 'health', 'wellness', 'medical', 'clinic', 'prescription', 'drug', 'care', 'pharmacie', 'santé', 'bien-être', 'médicament', 'clinique', 'ordonnance'],
        confidence: 90
    },
    gym: {
        keywords: ['gym', 'fitness', 'training', 'workout', 'sport', 'exercise', 'wellness', 'crossfit', 'yoga', 'club', 'remise en forme', 'entrainement', 'sport', 'exercice', 'musculation', 'cardio', 'yoga', 'centre sportif'],
        confidence: 85
    },
    restaurant: {
        keywords: ['restaurant', 'food', 'eatery', 'bistro', 'grill', 'burger', 'pizza', 'sushi', 'bar', 'pub', 'diner', 'resto', 'bistro', 'brasserie', 'pizzeria', 'grill', 'bar', 'pub', 'cantine', 'sandwicherie'],
        confidence: 80
    },
    convenience: {
        keywords: ['convenience', 'corner store', 'mini mart', 'gas', 'fuel', 'snack', 'quick stop', 'service station', 'dépanneur', 'station-service', 'essence', 'magasin de proximité', 'boutique', 'snack', 'station'],
        confidence: 85
    },
    bakery: {
        keywords: ['bakery', 'bakehouse', 'bread', 'pastry', 'patisserie', 'boulangerie', 'bagel', 'croissant', 'dessert', 'boulangerie', 'pâtisserie', 'pain', 'viennoiserie', 'dessert', 'croissant', 'gâteau'],
        confidence: 90
    },
    bar: {
        keywords: ['bar', 'pub', 'tavern', 'brewery', 'beer', 'club', 'cocktail', 'wine', 'taproom', 'bar', 'pub', 'brasserie', 'bière', 'cocktail', 'vins', 'soirée', 'taverne', 'microbrasserie'],
        confidence: 85
    },
    shopping: {
        keywords: ['mall', 'store', 'boutique', 'shop', 'retail', 'fashion', 'clothing', 'apparel', 'outlet', 'magasin', 'boutique', 'centre commercial', 'vêtements', 'mode', 'détaillant'],
        confidence: 75
    },
    bank: {
        keywords: ['bank', 'atm', 'credit', 'finance', 'trust', 'financial', 'deposit', 'branch', 'banque', 'guichet', 'crédit', 'finance', 'caisse', 'succursale', 'dépôt'],
        confidence: 85
    },
    hotel: {
        keywords: ['hotel', 'motel', 'inn', 'resort', 'lodge', 'bnb', 'hostel', 'accommodation', 'stay', 'hôtel', 'motel', 'auberge', 'gîte', 'hébergement', 'chalet', 'resort'],
        confidence: 90
    },
    gas: {
        keywords: ['gas', 'station', 'fuel', 'petrol', 'service', 'garage', 'auto', 'car wash', 'repair', 'station-service', 'essence', 'garage', 'voiture', 'automobile', 'réparation', 'lavage auto'],
        confidence: 85
    },
    hospital: {
        keywords: ['hospital', 'clinic', 'medical', 'doctor', 'dentist', 'emergency', 'urgent care', 'hôpital', 'clinique', 'médecin', 'dentiste', 'urgence', 'soins', 'centre médical'],
        confidence: 90
    },
    school: {
        keywords: ['school', 'college', 'university', 'academy', 'campus', 'education', 'institute', 'école', 'collège', 'université', 'académie', 'campus', 'formation', 'institut'],
        confidence: 85
    },
    library: {
        keywords: ['library', 'bookstore', 'books', 'reading', 'literature', 'novel', 'librairie', 'bibliothèque', 'livres', 'lecture', 'roman'],
        confidence: 90
    },
    park: {
        keywords: ['park', 'trail', 'forest', 'nature', 'hiking', 'camping', 'reserve', 'parc', 'sentier', 'forêt', 'nature', 'randonnée', 'camping', 'réserve'],
        confidence: 85
    },
    transportation: {
        keywords: ['airport', 'terminal', 'flight', 'airlines', 'travel', 'aeroport', 'station', 'bus', 'metro', 'train', 'aéroport', 'terminal', 'vol', 'compagnie aérienne', 'voyage', 'station', 'gare', 'train', 'métro'],
        confidence: 85
    },
    organic_grocery: {
        keywords: ['bio', 'en vrac', 'local', 'zéro déchet', 'naturel', 'santé', 'coop', 'écoresponsable', 'ferme', 'organic', 'bulk', 'zero waste', 'eco', 'natural', 'farm', 'sustainable'],
        confidence: 90
    },
    herbal_shop: {
        keywords: ['herboristerie', 'naturopathie', 'plantes', 'tisanes', 'huiles essentielles', 'suppléments', 'herbal', 'apothecary', 'naturopath', 'supplements', 'vitamins', 'essential oils'],
        confidence: 90
    },
    health_cafe: {
        keywords: ['café', 'bar à jus', 'smoothie', 'matcha', 'kombucha', 'bio', 'vegan', 'coffee', 'juice bar', 'smoothie', 'matcha', 'kombucha', 'organic coffee'],
        confidence: 85
    },
    farmers_market: {
        keywords: ['ferme', 'marché', 'producteur local', 'fromagerie', 'miel', 'artisanal', 'farm', 'farmers market', 'local produce', 'cheese', 'honey', 'artisan'],
        confidence: 90
    }
};
// Helper function to normalize text
function normalizeText(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' '); // Normalize spaces
}
// Helper function to calculate similarity between strings
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0)
        return 1.0;
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}
// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[str2.length][str1.length];
}
// Main detection function
function detectBusinessType(name, address) {
    const normalizedName = normalizeText(name);
    const normalizedAddress = address ? normalizeText(address) : '';
    const fullText = `${normalizedName} ${normalizedAddress}`.trim();
    // Priority 0: Obvious patterns (100% confidence) - Grocery first to prevent misclassification
    const obviousPatterns = [
        { pattern: 'épicerie', category: 'grocery', confidence: 100 },
        { pattern: 'fruiterie', category: 'grocery', confidence: 100 },
        { pattern: 'supermarché', category: 'grocery', confidence: 100 },
        { pattern: 'supermarket', category: 'grocery', confidence: 100 },
        { pattern: 'grocery', category: 'grocery', confidence: 100 },
        { pattern: 'café', category: 'coffee', confidence: 100 },
        { pattern: 'coffee', category: 'coffee', confidence: 100 },
        { pattern: 'pharmacie', category: 'pharmacy', confidence: 100 },
        { pattern: 'pharmacy', category: 'pharmacy', confidence: 100 },
        { pattern: 'restaurant', category: 'restaurant', confidence: 100 },
        { pattern: 'resto', category: 'restaurant', confidence: 100 },
        { pattern: 'boulangerie', category: 'bakery', confidence: 100 },
        { pattern: 'bakery', category: 'bakery', confidence: 100 },
        { pattern: 'gym', category: 'gym', confidence: 100 },
        { pattern: 'fitness', category: 'gym', confidence: 100 },
        { pattern: 'bank', category: 'bank', confidence: 100 },
        { pattern: 'banque', category: 'bank', confidence: 100 },
        { pattern: 'hotel', category: 'hotel', confidence: 100 },
        { pattern: 'hôtel', category: 'hotel', confidence: 100 },
        { pattern: 'école', category: 'school', confidence: 100 },
        { pattern: 'school', category: 'school', confidence: 100 },
        { pattern: 'université', category: 'school', confidence: 100 },
        { pattern: 'university', category: 'school', confidence: 100 },
        { pattern: 'bibliothèque', category: 'library', confidence: 100 },
        { pattern: 'library', category: 'library', confidence: 100 },
        { pattern: 'hôpital', category: 'hospital', confidence: 100 },
        { pattern: 'hospital', category: 'hospital', confidence: 100 },
        { pattern: 'parc', category: 'park', confidence: 100 },
        { pattern: 'park', category: 'park', confidence: 100 },
        { pattern: 'bio', category: 'organic_grocery', confidence: 100 },
        { pattern: 'organic', category: 'organic_grocery', confidence: 100 },
        { pattern: 'herboristerie', category: 'herbal_shop', confidence: 100 },
        { pattern: 'herbal', category: 'herbal_shop', confidence: 100 },
        { pattern: 'bar à jus', category: 'health_cafe', confidence: 100 },
        { pattern: 'juice bar', category: 'health_cafe', confidence: 100 },
        { pattern: 'marché fermier', category: 'farmers_market', confidence: 100 },
        { pattern: 'farmers market', category: 'farmers_market', confidence: 100 }
    ];
    for (const { pattern, category, confidence } of obviousPatterns) {
        if (fullText.includes(pattern)) {
            const categoryObj = exports.BUSINESS_CATEGORIES.find(cat => cat.id === category);
            return {
                category: categoryObj,
                confidence,
                matchedTerm: pattern
            };
        }
    }
    // Priority 1: Exact business name match (highest confidence)
    for (const [businessName, data] of Object.entries(QUEBEC_BUSINESSES)) {
        if (normalizedName.includes(businessName) || businessName.includes(normalizedName)) {
            const category = exports.BUSINESS_CATEGORIES.find(cat => cat.id === data.category);
            return {
                category,
                confidence: data.confidence,
                matchedTerm: businessName
            };
        }
    }
    // Priority 2: Fuzzy business name match
    let bestMatch = null;
    for (const [businessName, data] of Object.entries(QUEBEC_BUSINESSES)) {
        const similarity = calculateSimilarity(normalizedName, businessName);
        if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { business: businessName, similarity, data };
        }
    }
    if (bestMatch && bestMatch.similarity > 0.7) {
        const category = exports.BUSINESS_CATEGORIES.find(cat => cat.id === bestMatch.data.category);
        return {
            category,
            confidence: Math.round(bestMatch.data.confidence * bestMatch.similarity),
            matchedTerm: bestMatch.business
        };
    }
    // Priority 3: Keyword pattern matching (comprehensive bilingual with confidence)
    for (const [categoryId, patternData] of Object.entries(KEYWORD_PATTERNS)) {
        for (const keyword of patternData.keywords) {
            if (fullText.includes(keyword)) {
                const category = exports.BUSINESS_CATEGORIES.find(cat => cat.id === categoryId);
                return {
                    category,
                    confidence: patternData.confidence,
                    matchedTerm: keyword
                };
            }
        }
    }
    // Priority 4: Partial business name match
    for (const [businessName, data] of Object.entries(QUEBEC_BUSINESSES)) {
        const words = businessName.split(' ');
        for (const word of words) {
            if (word.length > 3 && normalizedName.includes(word)) {
                const category = exports.BUSINESS_CATEGORIES.find(cat => cat.id === data.category);
                return {
                    category,
                    confidence: Math.round(data.confidence * 0.8),
                    matchedTerm: word
                };
            }
        }
    }
    // Fallback: Other category
    const otherCategory = exports.BUSINESS_CATEGORIES.find(cat => cat.id === 'other');
    return {
        category: otherCategory,
        confidence: 0,
        matchedTerm: 'unknown'
    };
}
exports.detectBusinessType = detectBusinessType;
// Helper function to get category by ID
function getCategoryById(categoryId) {
    return exports.BUSINESS_CATEGORIES.find(cat => cat.id === categoryId);
}
exports.getCategoryById = getCategoryById;
// Helper function to get all categories
function getAllCategories() {
    return exports.BUSINESS_CATEGORIES;
}
exports.getAllCategories = getAllCategories;
