// Kitchen App — Airtable Configuration
// TOKEN and BASE_ID are stored securely in Netlify Environment Variables
const CONFIG = {

  TABLES: {
    ORDERS:     'tblMnlLwYCD27ou80',
    LINE_ITEMS: 'tblcP1zvc3Tu9oQuL',
    DISHES:     'tblhkNaiSGBiLRUxA',
    RECIPES:    'tbl053nytobUU4ytc',
    BOM:        'tblpmPSqC7TuzElHI',
    COMPOSITE:  'tblCg9hg1F8oj1mQ7',
  },

  FIELDS: {
    // ── Orders ──
    ORDER_LINE_ITEMS:    'כמויות - משויך להזמנות אוכל מהמטבח',
    ORDER_DATE:          'תאריך ושעת ביצוע ההזמנה',   // DateTime — filter by YEAR/MONTH/DAY
    ORDER_DATE_DISPLAY:  'יום ותאריך',                  // formatted "26/7/2024"
    ORDER_STATUS:        'סטטוס הזמנה',                 // overall order status
    ORDER_COOK_STATUS:   'Статус приготовления',         // kitchen cooking status
    ORDER_NAME:          'שם ההזמנה',
    ORDER_SERIAL:        'מס\' סידורי',
    ORDER_ADDRESS:       'כתובת למשלוח',                // delivery address only
    ORDER_DELIVERY:      'משלוח',                        // checkbox: delivery required?
    ORDER_LOCATION:      'מיקום',                        // venue / location
    ORDER_PEOPLE:        'מספר אנשים',
    ORDER_EVENT_TYPE:    'סוג אירוע',                    // Поминки/Обрезание/Бар мицва/etc.
    ORDER_NOTES_EVENT:   'הערות לאירוע',
    ORDER_NOTES_KITCHEN: 'הערות למטבח',                 // order-level kitchen notes
    ORDER_EMPLOYEE:      'העובד שקיבל את ההזמנה',
    ORDER_CLIENT_LAST:   'Фамилия (from כרטיס לקוח)',   // lookup
    ORDER_CLIENT_FIRST:  'Имя (from כרטיס לקוח)',        // lookup
    ORDER_CLIENT_PHONE:  'Номер телефона (from כרטיס לקוח)', // lookup

    // ── Line Items ──
    // NOTE: field name uses Cyrillic "к" not Hebrew "כ"!
    LINE_ITEM_QTY:           'кол. (כמות)',
    LINE_ITEM_DISH:          'תפריטים עם מחירים (לחיבור למתכונים)', // → DISHES (primary)
    LINE_ITEM_RECIPE:        'מתכונים עם מחירים',       // → RECIPES (legacy fallback)
    LINE_ITEM_NAME:          'שם מאכל פורמולה',          // lookup array → [0]
    LINE_ITEM_NOTES_KITCHEN: 'הערות למטבח',
    LINE_ITEM_NOTES_CLIENT:  'הערות ללקוח',
    LINE_ITEM_ORDER_LINK:    'הזמנות אוכל מהמטבח',      // back-link to order
    LINE_ITEM_DONE:          'הוכן',                     // checkbox — requires field in Airtable

    // ── Dishes (תפריטים עם מחירים) ──
    DISH_NAME:      'שם המאכל ברוסית',
    DISH_TYPE:      'סוג מתכון',                         // "מתכון בודד" | "מתכון מורכב"
    DISH_RATIO:     'גודל המנה ביחס לכמות במתכון',       // Formula → ratio (THE KEY FIELD)
    DISH_RECIPE:    'מתכון',                              // → Recipes (simple path)
    DISH_COMPOSITE: 'טבלת הרכבות מאכלים (מאכל משולב מכמה מתכונים)', // → Composite
    DISH_UNIT:      'יחידת חישוב למנה/יחידה (from מתכון)',
    DISH_UNIT_QTY:  'כמות של יחידת החישוב למנה/יחידה (from מתכון)',
    DISH_WEIGHT:    'משקל או נפח למנה',
    DISH_PRICE:     'מחיר',                                // price per portion (update if field name differs)
    DISH_CATEGORY:   'קטגוריה (from מתכון)',               // lookup from Recipe → category filter
    DISH_KOSHER_NOTE:'הוראות כשרות (from מתכון)',         // lookup from Recipe → shown on order page
    DISH_STATUS:     'סטטוס',                              // select field → filter in add-dish modal

    // ── Recipes ──
    RECIPE_BOM:          'כמויות - משויך למתכונים עם מחירים',
    RECIPE_NAME:         'שם המאכל ברוסית',
    RECIPE_KOSHER_NOTE:  'הוראות כשרות',
    RECIPE_EQUIPMENT:    'ציוד',

    // ── BOM (Ingredients per 1 portion) ──
    BOM_QTY:          'Количество Брутто',
    BOM_UNIT:         'Ед. изм. (from קישור למוצר)',    // lookup → trim() + firstVal()
    BOM_NAME:         'Наименование (from продукт)',      // lookup array → firstVal()
    BOM_NAME_TEXT:    'Ингредиенты',                      // fallback plain text
    BOM_PRODUCT:      'продукт',
    BOM_NETTO_BEFORE: 'Нетто до т/о (чистое, до готовки)',
    BOM_NETTO_AFTER:  'Нетто после т/о (готовый продукт)',
    BOM_NOTES:        'Notes',

    // ── Composite (טבלת הרכבות מאכלים) ──
    COMPOSITE_RECIPE:    'מתכון',                         // → Recipes
    COMPOSITE_RATIO:     'גודל המנה ביחס לכמות במתכון',  // Formula = qty/qty_per_portion
    COMPOSITE_QTY:       'כמות (ע"פ יחי\' מידה של המתכון)',
    COMPOSITE_NOTES:     'הערות',
    COMPOSITE_DISH_LINK: 'סוגי מאכלים עם מחירים לתפריטים', // back-link to Dishes
    COMPOSITE_UNIT:      'יחידת חישוב למנה/יחידה (from מתכון)',
    COMPOSITE_UNIT_QTY:  'כמות של יחידת החישוב למנה/יחידה (from מתכון)',
  },

  // multiplier formula:
  //   ratio      = DISH.fields[DISH_RATIO]               (or COMPOSITE row's COMPOSITE_RATIO)
  //   multiplier = кол.(כמות) × ratio
  //   ingredient = Количество_Брутто × multiplier        (same for Нетто до/после)

  ORDER_STATUSES: [
    'В обработке',
    'Ожидает подтверждения менеджера',
    'Ожидает подтверждения клиента',
    'Подтверждён',
    'Не подтверждён',
    'Готов',
    'Завершен успешно',
    'Отменён',
  ],

  COOK_STATUSES: [
    'Выполнять',
    'В процессе',
    'готово',
    'Выяснить',
  ],

  // Shared secret sent as X-Api-Key on every proxy request.
  // Must match the PROXY_SECRET environment variable set in Netlify.
  // Leave empty ('') to disable the check (e.g., local dev without Netlify).
  PROXY_SECRET: '',

  APP_URL: (() => {
    try {
      const u = new URL(location.href);
      return u.origin + u.pathname.replace(/[^/]*$/, '');
    } catch { return './'; }
  })(),
};
