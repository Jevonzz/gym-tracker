/**
 * Built-in food list so meals can be logged without knowing the numbers.
 * Values are typical per-serving estimates for Malaysian hawker and home food
 * (based on MyFCD / HPB-style references); real portions vary, so treat them as a guide.
 */
export interface FoodPreset {
  name: string;
  serving: string;
  kcal: number;
  /** grams */
  protein: number;
}

export const FOOD_PRESETS: FoodPreset[] = [
  // Rice dishes
  { name: "Nasi lemak (basic, egg + sambal)", serving: "1 plate", kcal: 400, protein: 10 },
  { name: "Nasi lemak ayam goreng", serving: "1 plate", kcal: 780, protein: 32 },
  { name: "Nasi lemak rendang", serving: "1 plate", kcal: 700, protein: 28 },
  { name: "Nasi ayam (chicken rice)", serving: "1 plate", kcal: 620, protein: 30 },
  { name: "Nasi ayam, roasted", serving: "1 plate", kcal: 680, protein: 32 },
  { name: "Nasi goreng kampung", serving: "1 plate", kcal: 640, protein: 18 },
  { name: "Nasi goreng ayam", serving: "1 plate", kcal: 700, protein: 26 },
  { name: "Nasi goreng pattaya", serving: "1 plate", kcal: 780, protein: 26 },
  { name: "Nasi kandar (chicken + curry)", serving: "1 plate", kcal: 850, protein: 35 },
  { name: "Nasi campur (rice + 1 meat + 2 veg)", serving: "1 plate", kcal: 650, protein: 28 },
  { name: "Nasi briyani ayam", serving: "1 plate", kcal: 880, protein: 35 },
  { name: "Nasi kerabu", serving: "1 plate", kcal: 550, protein: 22 },
  { name: "Nasi dagang", serving: "1 plate", kcal: 600, protein: 22 },
  { name: "Economy rice (rice + 3 dishes)", serving: "1 plate", kcal: 700, protein: 28 },
  { name: "Claypot chicken rice", serving: "1 pot", kcal: 750, protein: 30 },
  { name: "White rice", serving: "1 cup cooked", kcal: 210, protein: 4 },
  { name: "Brown rice", serving: "1 cup cooked", kcal: 220, protein: 5 },

  // Noodles
  { name: "Mee goreng mamak", serving: "1 plate", kcal: 660, protein: 20 },
  { name: "Maggi goreng", serving: "1 plate", kcal: 600, protein: 15 },
  { name: "Char kuey teow", serving: "1 plate", kcal: 740, protein: 23 },
  { name: "Wantan mee (dry)", serving: "1 plate", kcal: 450, protein: 20 },
  { name: "Curry laksa", serving: "1 bowl", kcal: 590, protein: 22 },
  { name: "Asam laksa", serving: "1 bowl", kcal: 430, protein: 18 },
  { name: "Mee rebus", serving: "1 bowl", kcal: 560, protein: 17 },
  { name: "Mee soto", serving: "1 bowl", kcal: 450, protein: 22 },
  { name: "Pan mee (soup)", serving: "1 bowl", kcal: 480, protein: 20 },
  { name: "Hokkien mee (KL)", serving: "1 plate", kcal: 620, protein: 22 },
  { name: "Kuey teow soup", serving: "1 bowl", kcal: 350, protein: 18 },
  { name: "Bee hoon goreng", serving: "1 plate", kcal: 500, protein: 13 },
  { name: "Instant noodles (cooked)", serving: "1 pack", kcal: 380, protein: 8 },

  // Breads and snacks
  { name: "Roti canai", serving: "1 piece", kcal: 300, protein: 6 },
  { name: "Roti telur", serving: "1 piece", kcal: 420, protein: 13 },
  { name: "Roti tisu", serving: "1 piece", kcal: 400, protein: 6 },
  { name: "Murtabak ayam", serving: "1 portion", kcal: 720, protein: 32 },
  { name: "Thosai", serving: "1 piece", kcal: 180, protein: 4 },
  { name: "Chapati", serving: "1 piece", kcal: 200, protein: 6 },
  { name: "Roti bakar kaya butter", serving: "2 slices", kcal: 320, protein: 6 },
  { name: "Wholemeal bread", serving: "2 slices", kcal: 160, protein: 8 },
  { name: "Curry puff", serving: "1 piece", kcal: 250, protein: 5 },
  { name: "Kuih (assorted)", serving: "1 piece", kcal: 140, protein: 2 },
  { name: "Goreng pisang", serving: "2 pieces", kcal: 280, protein: 3 },
  { name: "Apam balik", serving: "1 slice", kcal: 300, protein: 6 },
  { name: "Pau (chicken / char siu)", serving: "1 piece", kcal: 250, protein: 10 },
  { name: "Satay ayam", serving: "10 sticks", kcal: 450, protein: 40 },
  { name: "Satay sauce", serving: "1 small bowl", kcal: 180, protein: 6 },
  { name: "Ketupat / nasi impit", serving: "5 pieces", kcal: 180, protein: 4 },

  // Proteins
  { name: "Ayam goreng", serving: "1 piece (thigh)", kcal: 330, protein: 25 },
  { name: "Chicken breast, grilled", serving: "150 g", kcal: 250, protein: 46 },
  { name: "Egg", serving: "1 large", kcal: 75, protein: 6 },
  { name: "Telur mata (fried egg)", serving: "1 egg", kcal: 100, protein: 6 },
  { name: "Ikan bakar", serving: "1 portion", kcal: 280, protein: 35 },
  { name: "Canned tuna in water", serving: "1 can (150 g)", kcal: 150, protein: 33 },
  { name: "Beef rendang", serving: "1 portion", kcal: 380, protein: 26 },
  { name: "Tofu", serving: "1 block (300 g)", kcal: 230, protein: 24 },
  { name: "Tempeh", serving: "100 g", kcal: 190, protein: 19 },
  { name: "Whey protein", serving: "1 scoop", kcal: 120, protein: 24 },

  // Drinks
  { name: "Teh tarik", serving: "1 glass", kcal: 150, protein: 4 },
  { name: "Kopi O", serving: "1 glass", kcal: 80, protein: 0 },
  { name: "Milo ais", serving: "1 glass", kcal: 220, protein: 6 },
  { name: "Milk, full cream", serving: "250 ml", kcal: 160, protein: 8 },
  { name: "Milk, low fat", serving: "250 ml", kcal: 110, protein: 9 },
  { name: "Soy milk (sweetened)", serving: "250 ml", kcal: 140, protein: 7 },
  { name: "Air sirap / bandung", serving: "1 glass", kcal: 160, protein: 1 },

  // Fruit and others
  { name: "Banana", serving: "1 medium", kcal: 105, protein: 1 },
  { name: "Oats", serving: "40 g dry", kcal: 150, protein: 5 },
  { name: "Peanut butter", serving: "1 tbsp", kcal: 95, protein: 4 },
  { name: "Greek yogurt", serving: "150 g", kcal: 130, protein: 15 },
  { name: "Cendol", serving: "1 bowl", kcal: 380, protein: 4 },
  { name: "ABC (ais kacang)", serving: "1 bowl", kcal: 300, protein: 4 },
];
