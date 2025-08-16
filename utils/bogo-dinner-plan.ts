export interface BOGODeal {
  id: number;
  title: string;
  price_text: string | null;
  category: string;
}

export interface DinnerMeal {
  day: string;
  theme: string;
  emoji: string;
  items: {
    name: string;
    price: string;
    emoji: string;
    description?: string;
  }[];
  totalCost: number;
  totalItems: number;
}

export interface BOGODinnerPlan {
  weekOf: string;
  mainMeals: DinnerMeal[];
  bonusMeals: DinnerMeal[];
  summary: {
    totalCost: number;
    totalValue: number;
    totalSavings: number;
    averagePerDinner: number;
    totalDinners: number;
  };
}

// Template for generating BOGO dinner plans
export const generateBOGODinnerPlan = (bogoDeals: BOGODeal[]): BOGODinnerPlan => {
  // Helper to extract price from BOGO text
  const getPrice = (priceText: string | null): number => {
    if (!priceText) return 0;
    const match = priceText.match(/\$(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };

  // Find deals by keywords
  const findDeals = (keywords: string[]): BOGODeal[] => {
    return bogoDeals.filter(deal => 
      keywords.some(keyword => 
        deal.title?.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  };

  // Main 7-day meal plan template
  const mainMeals: DinnerMeal[] = [
    {
      day: "Monday",
      theme: "Italian Pasta Night",
      emoji: "🍝",
      items: [
        ...findDeals(["pasta", "mueller"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Pasta",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍝"
        })),
        ...findDeals(["sauce", "ragu", "marinara"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Sauce",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍅"
        })),
        ...findDeals(["parmesan", "cheese"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Cheese",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🧀"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Tuesday",
      theme: "Comfort Food Night",
      emoji: "🥩",
      items: [
        ...findDeals(["meatball", "rosina"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Meatballs",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥩"
        })),
        ...findDeals(["bread", "hawaiian"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Bread",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍞"
        })),
        ...findDeals(["dressing", "litehouse"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Dressing",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🧀"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Wednesday",
      theme: "Pizza Night",
      emoji: "🍕",
      items: [
        ...findDeals(["pizza", "caulipower"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Pizza",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍕"
        })),
        ...findDeals(["salad", "fresh attitude"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Salad",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥗"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Thursday",
      theme: "Fish Dinner",
      emoji: "🐟",
      items: [
        ...findDeals(["fish", "gorton"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Fish",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🐟"
        })),
        ...findDeals(["vegetables", "green giant"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Vegetables",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥔"
        })),
        ...findDeals(["english muffin", "thomas"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "English Muffins",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍞",
          description: "as dinner rolls"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Friday",
      theme: "Taco Night",
      emoji: "🌮",
      items: [
        ...findDeals(["taco", "kit"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Taco Kit",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🌮"
        })),
        ...findDeals(["feta", "athenos"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Feta Cheese",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🧀",
          description: "as taco cheese"
        })),
        ...findDeals(["tzatziki", "cedar"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Tzatziki",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥑",
          description: "as taco sauce"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Saturday",
      theme: "Chicken Night",
      emoji: "🍗",
      items: [
        ...findDeals(["chicken", "realgood"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Chicken",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍗"
        })),
        ...findDeals(["rice", "ben's original"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Rice",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍚"
        })),
        ...findDeals(["vegetables", "green giant"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Vegetables",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥕"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Sunday",
      theme: "Sandwich Night",
      emoji: "🥪",
      items: [
        ...findDeals(["uncrustables", "smucker"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Uncrustables",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥪"
        })),
        ...findDeals(["apple", "hero"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Apples",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍎"
        })),
        ...findDeals(["oreo", "nabisco"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Oreo Cookies",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍪",
          description: "dessert"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    }
  ];

  // Bonus meals template
  const bonusMeals: DinnerMeal[] = [
    {
      day: "Bonus 1",
      theme: "BBQ Night",
      emoji: "🔥",
      items: [
        ...findDeals(["bacon", "smithfield"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Bacon",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥩"
        })),
        ...findDeals(["bbq", "sweet baby ray"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "BBQ Sauce",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍖"
        })),
        ...findDeals(["michelina"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Side Entree",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥔",
          description: "as a side"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Bonus 2",
      theme: "Gourmet Night",
      emoji: "🍷",
      items: [
        ...findDeals(["wine", "windfinder", "cabernet"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Wine",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍷"
        })),
        ...findDeals(["goat cheese", "celebrity"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Goat Cheese",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🧀"
        })),
        ...findDeals(["bread", "pepperidge farm"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Bread",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥖"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    },
    {
      day: "Bonus 3",
      theme: "Comfort Soup Night",
      emoji: "🍲",
      items: [
        ...findDeals(["broth", "college inn"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Broth",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍲"
        })),
        ...findDeals(["goldfish", "pepperidge"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Goldfish Crackers",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🍪",
          description: "as soup crackers"
        })),
        ...findDeals(["nuts", "planters"]).slice(0, 1).map(deal => ({
          name: deal.title?.replace(/,.*BOGO.*/, '') || "Mixed Nuts",
          price: deal.price_text?.replace(/.*BOGO\s*/, '') || "",
          emoji: "🥜",
          description: "protein snack"
        }))
      ],
      totalCost: 0,
      totalItems: 0
    }
  ];

  // Calculate totals for each meal
  const calculateMealTotals = (meal: DinnerMeal): DinnerMeal => {
    const totalCost = meal.items.reduce((sum, item) => {
      const price = getPrice(item.price);
      return sum + price;
    }, 0);
    
    return {
      ...meal,
      totalCost: Math.round(totalCost * 100) / 100,
      totalItems: meal.items.length * 2 // BOGO = double items
    };
  };

  const processedMainMeals = mainMeals.map(calculateMealTotals);
  const processedBonusMeals = bonusMeals.map(calculateMealTotals);

  // Calculate overall summary
  const totalCost = [...processedMainMeals, ...processedBonusMeals].reduce((sum, meal) => sum + meal.totalCost, 0);
  const totalValue = totalCost * 2; // BOGO = double value
  const totalDinners = (processedMainMeals.length + processedBonusMeals.length) * 2; // BOGO = double meals

  return {
    weekOf: "August 14-20, 2024",
    mainMeals: processedMainMeals,
    bonusMeals: processedBonusMeals,
    summary: {
      totalCost: Math.round(totalCost * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      totalSavings: Math.round((totalValue - totalCost) * 100) / 100,
      averagePerDinner: Math.round((totalCost / totalDinners) * 100) / 100,
      totalDinners
    }
  };
};

// Format meal for display
export const formatMealDisplay = (meal: DinnerMeal): string => {
  const itemsList = meal.items.map(item => 
    `${item.emoji} **${item.name}** (BOGO ${item.price})${item.description ? ` *(${item.description})*` : ''}`
  ).join('\n');
  
  return `### **${meal.day}: ${meal.theme}**
${itemsList}
💰 **Total**: Get ${meal.totalItems} items, pay for ${meal.items.length} = $${meal.totalCost} for 2 dinners`;
};

// Format full plan for display
export const formatFullPlan = (plan: BOGODinnerPlan): string => {
  const mainMealsText = plan.mainMeals.map(formatMealDisplay).join('\n\n');
  const bonusMealsText = plan.bonusMeals.map(formatMealDisplay).join('\n\n');
  
  return `# 🍽️ Weekly BOGO Dinner Plan
*7 dinners using ONLY Publix BOGOs (${plan.weekOf})*

${mainMealsText}

---

## 🎁 Bonus BOGO Meals

${bonusMealsText}

---

## 📊 Week Summary
- **Total Cost**: $${plan.summary.totalCost} for ${plan.summary.totalDinners} complete dinners
- **Actual Value**: $${plan.summary.totalValue} worth of food
- **Savings**: $${plan.summary.totalSavings} (50% off every meal!)
- **Per Dinner**: $${plan.summary.averagePerDinner} average

**🎯 The Beauty**: Every single item is BOGO, so you literally get 2 weeks of dinners for the price of 1 week!`;
};
