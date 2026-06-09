const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const { createCanvas, registerFont } = require('canvas');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { LiveChat } = require('youtube-chat');
const cron = require('node-cron');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// === حماية ضد الكراش ===
process.on('uncaughtException', (err) => console.error('خطأ غير متوقع:', err.message));
process.on('unhandledRejection', (err) => console.error('Promise مرفوض:', err.message));

// === المتغيرات ===
const YT_STREAM_KEY = process.env.YT_STREAM_KEY || 'حط_مفتاح_البث_هنا';
const YT_API_KEY = process.env.YT_API_KEY || 'حط_API_KEY_هنا';
const CHANNEL_ID = process.env.YT_CHANNEL_ID || 'حط_Channel_ID_هنا';
const CHANNEL_NAME = 'ɪʈʂ ʈɑkɪ!! 🇩🇿²⁴';
let viewers = 0, chatMessages = [];
let jokeIndex = 0;
let motivationIndex = 0;
let currentMode = 'main', currentOverlay = null;
let ffmpegProcess = null, chatBot = null;
let channelStats = { subs: '4.9K', views: '2.8M', videos: '36', lastVid: '1M' };

// === البيانات تاعك ===
// === 1. البيانات الكبيرة - 100 لغز ===
const HOUMA_QUIZZES = [
  { q: 'عاصمة الجزائر؟', a: 'الجزائر' },
  { q: 'وش هي الولاية رقم 16؟', a: 'الجزائر' },
  { q: 'طبق جزائري باللحم والبرقوق؟', a: 'اللحم لحلو' },
  { q: 'أكبر صحراء في العالم وين جاية؟', a: 'الجزائر' },
  { q: 'وش يسميو "الكسكس" في الغرب؟', a: 'الطعام' },
  { q: 'فريق جزائري يسموه "العميد"؟', a: 'مولودية' },
  { q: 'مغني الراي "ملك الراي"؟', a: 'الشاب خالد' },
  { q: 'جبال في شمال الجزائر؟', a: 'الأطلس' },
  { q: 'عملة الجزائر؟', a: 'الدينار' },
  { q: 'أطول واد في الجزائر؟', a: 'الشلف' },
  { q: 'وش هي "الحايك"؟', a: 'لباس تقليدي' },
  { q: 'ميناء جزائري كبير؟', a: 'وهران' },
  { q: 'أكلة شعبية في رمضان بالطماطم؟', a: 'شربة فريك' },
  { q: 'وش يسميو الطفل الصغير؟', a: 'الذري' },
  { q: 'رئيس الجزائر استقلت في عهدو؟', a: 'بن بلة' },
  { q: 'جبل في جيجل يسموه؟', a: 'بابور' },
  { q: 'وش هي "القرقاعو"؟', a: 'الجوز' },
  { q: 'مدينة الورود؟', a: 'البليدة' },
  { q: 'وش يسميو "الحليب الرايب"؟', a: 'اللبن' },
  { q: 'ملعب 5 جويلية في؟', a: 'الجزائر' },
  { q: 'أكلة بالسميد والتمر؟', a: 'الرفيس' },
  { q: 'وش هي "الزردة"؟', a: 'وليمة' },
  { q: 'بحيرة في الشرق الجزائري؟', a: 'فزازة' },
  { q: 'وش يسميو "الفلفل الحار"؟', a: 'الحار' },
  { q: 'مدينة "بونة" ضرك واش اسمها؟', a: 'عنابة' },
  { q: 'وش هي "الكديد"؟', a: 'لحم مجفف' },
  { q: 'أكلة تاع الصباح بالزيت؟', a: 'المسمن' },
  { q: 'وش يسميو "الجد" في الغرب؟', a: 'جدو' },
  { q: 'أعلى قمة في الجزائر؟', a: 'تاهات' },
  { q: 'وش هي "البسيسة"؟', a: 'أكلة شعير' },
  { q: 'مدينة الصخر العتيق؟', a: 'قسنطينة' },
  { q: 'وش يسميو "القهوة" في الصحراء؟', a: 'التاي' },
  { q: 'أكلة بالبطاطا والبيض؟', a: 'عجة' },
  { q: 'وش هي "البرنوس"؟', a: 'لباس رجالي' },
  { q: 'واد يصب في البحر المتوسط؟', a: 'سيبوس' },
  { q: 'وش يسميو "المرأة"؟', a: 'المرا' },
  { q: 'أكلة حلوة بالعسل؟', a: 'الزلابية' },
  { q: 'وش هي "التويزة"؟', a: 'تعاون' },
  { q: 'مدينة "هيبون" ضرك واش اسمها؟', a: 'عنابة' },
  { q: 'وش يسميو "الشارع"؟', a: 'الزنقة' },
  { q: 'أكلة بالفول؟', a: 'البيصارة' },
  { q: 'وش هي "القندورة"؟', a: 'لباس نسائي' },
  { q: 'أقدم مدينة في الجزائر؟', a: 'قسنطينة' },
  { q: 'وش يسميو "البيت" في الصحراء؟', a: 'الخيمة' },
  { q: 'أكلة بالدجاج والزيتون؟', a: 'طاجين' },
  { q: 'وش هي "الرحبة"؟', a: 'ساحة' },
  { q: 'مدينة المليون شهيد؟', a: 'الجزائر' },
  { q: 'وش يسميو "الفلوس"؟', a: 'الدراهم' },
  { q: 'أكلة شتوية ساخنة؟', a: 'الحريرة' },
  { q: 'وش هي "الحومة"؟', a: 'الحي' },
  { q: 'مغني "ديدي"؟', a: 'الشاب خالد' },
  { q: 'وش يسميو "الأب" في الشرق؟', a: 'بابا' },
  { q: 'أكلة باللحم والخضرة؟', a: 'المرقة' },
  { q: 'وش هي "القلة"؟', a: 'جرة ماء' },
  { q: 'مدينة الذهب الأسود؟', a: 'حاسي مسعود' },
  { q: 'وش يسميو "الصحن"؟', a: 'الطبسي' },
  { q: 'أكلة بالسمك؟', a: 'السردين' },
  { q: 'وش هي "الجرية"؟', a: 'الجري' },
  { q: 'ولاية رقم 1؟', a: 'أدرار' },
  { q: 'وش يسميو "الليل" في الدارجة؟', a: 'الليل' },
  { q: 'أكلة بالبيض والطماطم؟', a: 'الشكشوكة' },
  { q: 'وش هي "الدوارة"؟', a: 'أكلة أحشاء' },
  { q: 'مدينة "تلمسان" لقبها؟', a: 'لؤلؤة المغرب' },
  { q: 'وش يسميو "السوق"؟', a: 'السوق' },
  { q: 'أكلة حلوة باللوز؟', a: 'المقروط' },
  { q: 'وش هي "الخميسة"؟', a: 'تميمة' },
  { q: 'أطول نهار في السنة؟', a: '21 جوان' },
  { q: 'وش يسميو "القمر"؟', a: 'القمر' },
  { q: 'أكلة بالعدس؟', a: 'العدس' },
  { q: 'وش هي "البخنوق"؟', a: 'غطاء رأس' },
  { q: 'مدينة "تيبازة" مشهورة بـ؟', a: 'الآثار الرومانية' },
  { q: 'وش يسميو "الشتاء"؟', a: 'الشتا' },
  { q: 'أكلة بالقرع؟', a: 'الكابويا' },
  { q: 'وش هي "المهراس"؟', a: 'مدقة' },
  { q: 'أقصر نهار في السنة؟', a: '21 ديسمبر' },
  { q: 'وش يسميو "الشمس"؟', a: 'الشمس' },
  { q: 'أكلة باللوبيا؟', a: 'اللوبيا' },
  { q: 'وش هي "القصعة"؟', a: 'صحن كبير' },
  { q: 'مدينة "غرداية" سكانها؟', a: 'المزاب' },
  { q: 'وش يسميو "الصيف"؟', a: 'الصيف' },
  { q: 'أكلة بالجلبانة؟', a: 'الجلبانة' },
  { q: 'وش هي "المغرف"؟', a: 'ملعقة' },
  { q: 'أول نوفمبر 1954؟', a: 'اندلاع الثورة' },
  { q: 'وش يسميو "الربيع"؟', a: 'الربيع' },
  { q: 'أكلة بالحمص؟', a: 'الحمص' },
  { q: 'وش هي "الفرشيطة"؟', a: 'شوكة' },
  { q: '5 جويلية 1962؟', a: 'الاستقلال' },
  { q: 'وش يسميو "الخريف"؟', a: 'الخريف' },
  { q: 'أكلة بالفاصوليا؟', a: 'اللوبيا' },
  { q: 'وش هي "الموس"؟', a: 'سكين' },
  { q: '1 نوفمبر؟', a: 'عيد الثورة' },
  { q: 'وش يسميو "الخبز"؟', a: 'الخبز' },
  { q: 'أكلة بالسبانخ؟', a: 'السلق' },
  { q: 'وش هي "الطابونة"؟', a: 'فرن' },
  { q: '19 مارس 1962؟', a: 'عيد النصر' },
  { q: 'وش يسميو "الماء"؟', a: 'الما' },
  { q: 'أكلة بالباذنجان؟', a: 'الزعلوك' },
  { q: 'وش هي "الكانون"؟', a: 'موقد' },
  { q: '20 أوت 1955؟', a: 'هجومات الشمال' },
  { q: 'وش يسميو "النار"؟', a: 'النار' },
  { q: 'أكلة بالكوسة؟', a: 'القرعة' },
  { q: 'وش هي "الغربال"؟', a: 'منخل' }
];

// === 2. 30 نكتة TAKI ===
const JOKES = [
  "واحد دخل للحومة.. لقا الكل مليونيرات.. قال: راني في الحلم ولا في TAKI؟ 😂",
  "قالو للأستاذ علاش ما تدخلش لايف TAKI؟ قال: نخاف نولي تلميذ 😂",
  "واحد سقسا صاحبو: وين راك؟ قالو: في الحومة.. قالو: يا راجل راك في الدار.. قالو: لا لا حومة TAKI 😂👑",
  "المدير للتلاميذ: اللي يجيب 20 نعطيه مليون.. التلميذ: ندخل لايف TAKI أسهل 😂⚡",
  "واحد قال لمرتو: راني رايح للحومة.. قاتلو: تدي الدراري؟ قالها: لا لا حومة TAKI 😂",
  "الطبيب للمريض: لازمك راحة.. المريض: ندخل لايف TAKI نرتاح 😂💎",
  "واحد شرا تليفون جديد.. أول حاجة دارها: حمل يوتيوب باه يتفرج TAKI 😂👑",
  "الأم لولدها: نوض تقرا.. الولد: راني نقرا في حومة TAKI 😂⚡",
  "واحد ربح المليون في TAKI.. مشى للبنك.. قالولو: وينهم الدراهم؟ قال: نقاط 😂",
  "قالو لواحد: وش تحب تكون كي تكبر؟ قال: إمبراطور في حومة TAKI 😂👑",
  "واحد دخل للجامع.. الإمام يقول: آمين.. هو يجاوب: +10 نقاط 😂",
  "الشرطي للمواطن: وين رايح في الليل؟ المواطن: لايف TAKI راهو 24/7 😂⚡",
  "واحد حلم روحو ملك.. ناض الصباح لقا تاج الإمبراطور في TAKI 😂👑",
  "البنكة تعيط: رصيدك 0.. هو يرد: رصيدي 500 في TAKI 😂💎",
  "واحد قال لصاحبو: راني مهموم.. صاحبو: ادخل TAKI تنسى همك 😂",
  "الأستاذ: 1+1=؟ التلميذ: 2 + 100 نقطة في TAKI 😂⚡",
  "واحد شرا سيارة.. كتب فيها: ممنوع الدخول إلا مشتركي TAKI 😂👑",
  "الزوجة لراجلها: علاش ساهر؟ الراجل: كاين كنز في TAKI 😂💎",
  "واحد دخل مطعم.. قال للڨارسون: عطيني مينو TAKI 😂",
  "الإمام: من فطر اليوم؟ واحد: انا.. بصح ربحت في مود الفجر 😂🌙",
  "واحد قال ليماه: كبرت ضرك.. يماه: واش وليت؟ هو: TOP 1 في TAKI 😂👑",
  "الطبيب: عندك إدمان.. المريض: على TAKI برك 😂⚡",
  "واحد في الحبس.. قال للحارس: عندكم واي فاي؟ نحب ندخل TAKI 😂",
  "الأب لولدو: جيب الخبز.. الولد: بعد اللغز تاع TAKI 😂",
  "واحد راح للعمرة.. دعا: يا رب نربح المليون في TAKI 😂👑",
  "المحامي للقاضي: موكلي بريء.. القاضي: الدليل؟ المحامي: TOP 3 في TAKI 😂⚡",
  "واحد قال لصاحبتو: نحبك قد نقاطي في TAKI.. هي: شحال؟ هو: 500 😂💎",
  "المدرب للاعبين: اللي يسجل نعطيه بريم.. اللاعب: ولا تاج في TAKI؟ 😂👑",
  "واحد في الطيارة.. المضيفة: تحب قهوة؟ هو: نحب لايف TAKI 😂",
  "الجدة لحفيدها: واش راك تدير في التليفون؟ هو: نبني إمبراطورية في TAKI 😂👑"
];

// === 3. 40 تحفيز إمبراطوري ===
const MOTIVATIONS = [
  "⚡ انت أسطورة الحومة.. المليون يستناك ⚡",
  "👑 ملك/ملكة اللايف.. كمل هكذا 👑",
  "🔥 الحومة تفتخر بيك.. زيد ولعها 🔥",
  "💎 انت TOP 1 في قلبنا.. المليون قريب 💎",
  "⚡ برق الإمبراطور.. ما يوقفك حد ⚡",
  "🏆 المليونير القادم راهو يتفرج ضرك.. بلاك انت؟ 🏆",
  "👑 تاج الإمبراطور يستنى راسك 👑",
  "🔥 اللي يصبر ينال.. وانت صبرت بزاف 🔥",
  "⚡ الحومة ما تنساش ولادها.. وانت ولدها ⚡",
  "💎 1000 نقطة = 1 خطوة للمليون 💎",
  "👑 اللي ما يحضرش ضرك يندم غدوة 👑",
  "🔥 انت السبب باش الحومة مولعة 🔥",
  "⚡ كل نقطة تكتب تاريخك في TAKI ⚡",
  "🏆 4.9K يشوفو فيك.. ورينا شطارتك 🏆",
  "👑 الإمبراطور ما يطيحش.. وانت إمبراطور 👑",
  "🔥 اللي يضحك اللخر يضحك مليح.. وانت تضحك ضرك 🔥",
  "⚡ سرعتك = نقاطك = تاجك ⚡",
  "💎 الناس العادية ترقد.. الأساطير تسهر مع TAKI 💎",
  "👑 اسمك راح يتكتب في تاريخ الحومة 👑",
  "🔥 الشاشة تشهد.. انت ما رحتش رغم كلشي 🔥",
  "⚡ 2.8M مشاهدة شافت أبطال.. وانت منهم ⚡",
  "🏆 المليون مش حلم.. هو قرار.. وانت قررت 🏆",
  "👑 اللي يبقى للخر هو الملك 👑",
  "🔥 نقطة بنقطة يحمل الواد.. وانت تعمر 🔥",
  "⚡ الزهر للناس.. والذكاء ليك ⚡",
  "💎 تربح ولا تخسر.. المهم راك هنا معانا 💎",
  "👑 الحومة عايلة.. وانت فرد منها 👑",
  "🔥 كل لغز تحلو يزيدك هيبة 🔥",
  "⚡ ما تخممش في الترتيب.. خمم في المتعة ⚡",
  "🏆 TOP 3 يستناك.. هيا طلع 🏆",
  "👑 الإمبراطوريات ما تبناوش في نهار.. وانت تبني 👑",
  "🔥 الضحكة تاعك ضرك = ذكرى غدوة 🔥",
  "⚡ اللي ما يشاركش ما يربحش.. وانت تشارك ⚡",
  "💎 500 نقطة؟ ساهلة عليك 💎",
  "👑 اسمك + TAKI = أسطورة 👑",
  "🔥 النار اللي فيك ما يطفيها حتى واحد 🔥",
  "⚡ كل ثانية هنا = استثمار في روحك ⚡",
  "🏆 المليون قريب.. شم الريحة؟ 🏆",
  "👑 الناس تتفرج.. وانت تصنع الحدث 👑",
  "🔥 الحومة مدرسة.. وانت الأستاذ 🔥"
];

// === 4. 25 كلمة كنز المليون ===
const TREASURE_WORDS = [
  "تكنولوجيا", "إمبراطور", "جزائرية", "مليونير", "الحومة",
  "أسطورة", "برق", "تاج", "كنز", "مخفي",
  "فخامة", "ملكي", "ذهبي", "ناري", "مشتعل",
  "انتصار", "تحدي", "مغامرة", "بطولة", "سيطرة",
  "زعامة", "قيادة", "نجومية", "عبقرية", "إبداع"
];

// === 5. 20 كلمة تفجير لحظة ===
const LIGHTNING_WORDS = [
  "زلابية", "بقلاوة", "مقروط", "رفيس", "مسمن",
  "برق", "رعد", "مطر", "شمس", "قمر",
  "أسد", "نسر", "صقر", "ذيب", "فهد",
  "ذهب", "فضة", "ماس", "ياقوت", "زمرد"
];

// === الخط ===
try { registerFont('./Cairo.ttf', { family: 'Cairo' }); } catch (e) { console.log('خط Cairo غير موجود'); }

// === 1. تحديد المود الحالي ===
function getCurrentMode() {
  try {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    if (day === 5 && hour === 21) return 'event';
    if (hour >= 20 && hour < 22) return 'million';
    if (hour >= 3 && hour < 10) return 'fajr';
    return 'main';
  } catch (e) { return 'main'; }
}

// === 2. جلب إحصائيات القناة ===
async function updateChannelStats() {
  if (!YT_API_KEY ||!CHANNEL_ID || YT_API_KEY.includes('حط')) return;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${YT_API_KEY}`;
    const res = await axios.get(url, { timeout: 5000 });
    if (res.data.items && res.data.items[0]) {
      const s = res.data.items[0].statistics;
      channelStats = {
        subs: parseInt(s.subscriberCount).toLocaleString('en-US'),
        views: parseInt(s.viewCount).toLocaleString('en-US'),
        videos: s.videoCount,
        lastVid: '1M'
      };
    }
  } catch (e) { console.log('فشل تحديث الإحصائيات:', e.message); }
}

// === 3. مولد Overlay الإمبراطوري ===
async function generateOverlay(db) {
  try {
    currentMode = getCurrentMode();
    const c = createCanvas(1920, 1080), x = c.getContext('2d');

    const gradients = { fajr: ['#0B132B', '#000000'], main: ['#001F3F', '#000000'], million: ['#3F2F00', '#000000'], event: ['#3F0000', '#000000'] };
    const g = x.createLinearGradient(0, 0, 1920, 1080);
    g.addColorStop(0, gradients[currentMode][0]);
    g.addColorStop(1, gradients[currentMode][1]);
    x.fillStyle = g; x.fillRect(0, 0, 1920, 1080);

    // شريط الإنجازات
    x.fillStyle = '#FFD700'; x.fillRect(0, 0, 1920, 60);
    x.font = 'bold 35px Cairo'; x.fillStyle = '#000';
    x.fillText('👑 محمد حطم الرقم: 1000 نقطة | 🔥 فاطمة أول بنت TOP 1 | ⚡ 847 مشاهد LIVE | 🏆 كنز اليوم مزال مخفي', 50, 42);

    // الهيدر
    x.strokeStyle = '#FFD700'; x.lineWidth = 4; x.strokeRect(40, 80, 1840, 220);
    x.fillStyle = 'rgba(0,0,0,0.9)'; x.fillRect(42, 82, 1836, 216);
    x.font = 'bold 75px Cairo';
    const nameGradient = x.createLinearGradient(50, 0, 800, 0);
    nameGradient.addColorStop(0, '#FFD700'); nameGradient.addColorStop(0.5, '#00BFFF'); nameGradient.addColorStop(1, '#FFD700');
    x.fillStyle = nameGradient; x.fillText(`👑 ${CHANNEL_NAME} 👑`, 50, 160);
    const modeNames = { fajr: 'مود الفجر الملكي 🌙', main: 'مود الحومة الإمبراطوري ⚡', million: 'مود المليون الملكي 👑', event: 'حدث TAKI الأسطوري 🔥' };
    x.font = '50px Cairo'; x.fillStyle = '#FFFFFF';
    x.fillText(`${modeNames[currentMode]} | المشاهدين: ${viewers}`, 50, 240);

    // الإحصائيات
    x.font = 'bold 42px Cairo'; x.fillStyle = '#FFD700'; x.fillText('📊 إحصائيات الإمبراطورية', 1200, 130);
    x.font = '38px Cairo'; x.fillStyle = '#FFD700'; x.fillText(`👑 المشتركين: ${channelStats.subs}`, 1200, 185);
    x.fillStyle = '#00BFFF'; x.fillText(`👁️ المشاهدات: ${channelStats.views}`, 1200, 235);
    x.fillStyle = '#FFFFFF'; x.fillText(`🎬 الفيديوهات: ${channelStats.videos}`, 1200, 285);

    // نكتة
    x.fillStyle = 'rgba(75,0,130,0.9)'; x.fillRect(50, 320, 1820, 80);
    x.strokeStyle = '#FF69B4'; x.lineWidth = 3; x.strokeRect(50, 320, 1820, 80);
    x.font = 'bold 35px Cairo'; x.fillStyle = '#FFD700'; x.fillText('😂 نكتة الحومة:', 70, 355);
    x.font = '32px Cairo'; x.fillStyle = '#FFFFFF'; x.fillText(JOKES[jokeIndex % JOKES.length], 70, 400);

    // تحفيز
    x.fillStyle = 'rgba(0,100,0,0.9)'; x.fillRect(50, 420, 1820, 70);
    x.strokeStyle = '#00FF00'; x.lineWidth = 3; x.strokeRect(50, 420, 1820, 70);
    x.font = 'bold 38px Cairo'; x.fillStyle = '#000'; x.textAlign = 'center';
    x.fillText(MOTIVATIONS[motivationIndex % MOTIVATIONS.length], 960, 465); x.textAlign = 'right';

    // المنطقة الوسطى - محمي بـ?.
    x.font = 'bold 60px Cairo'; x.fillStyle = '#FFFFFF';
    if (currentMode === 'fajr') {
      const verses = ['بسم الله الرحمن الرحيم', 'الحمد لله رب العالمين', 'الله لا إله إلا هو', 'قل هو الله أحد'];
      x.fillText('🕌 الآية الملكية:', 1870, 580);
      x.fillStyle = '#5BC0BE'; x.fillText(verses[db.data?.fajr?.verse % verses.length || 0], 1870, 660);
      x.font = '40px Cairo'; x.fillStyle = '#FFD700'; x.fillText('اكتب "آمين" +100 حسنة', 1870, 720);
    } else if (currentMode === 'main') {
      const quizIndex = db.data?.game?.quiz_index || 0;
      const quiz = HOUMA_QUIZZES[quizIndex % HOUMA_QUIZZES.length];
      x.fillText('🔥 لغز البرق الإمبراطوري 🔥', 1870, 580);
      x.fillStyle = '#00BFFF'; x.fillText(quiz.q, 1870, 660);
      x.font = '40px Cairo'; x.fillStyle = '#FFD700'; x.fillText('⚡ أسرع 3 يربحو 200 نقطة + لقب "برق الإمبراطور" ⚡', 1870, 720);
    } else if (currentMode === 'million') {
      x.fillText('💎 كنز TAKI المخفي 💎', 1870, 580);
      x.fillStyle = '#FFD700'; x.fillText('وش الكلمة السرية المخبية في فيديو اليوم؟', 1870, 660);
      x.font = '40px Cairo'; x.fillStyle = '#FF0000';
      const hints = db.data?.million?.hints_given || 0;
      x.fillText(`🔍 تلميح ${hints + 1}: الكلمة فيها 10 حروف وتبدا بـ "ت"`, 1870, 720);
      x.font = '35px Cairo'; x.fillStyle = '#FFFFFF'; x.fillText('اكتب!تفجير_الكنز + الكلمة | الجائزة: 500 نقطة + تاج 👑', 1870, 770);
    } else if (currentMode === 'event') {
      x.fillText('⚖️ محكمة الإمبراطور ⚖️', 1870, 580);
      x.fillStyle = '#FF0000'; x.fillText('التهمة: سرقة ستيلو الأستاذ', 1870, 660);
      x.font = '40px Cairo'; x.fillStyle = '#FFD700'; x.fillText('🔥 اكتب!براءة أو!إدانة | الجائزة: 5000 نقطة 🔥', 1870, 720);
    }

    // TOP 3 - محمي بـ?.
    const users = Object.entries(db.data?.users || {});
    const top3 = users.sort((a, b) => b[1].points - a[1].points).slice(0, 3);
    x.font = 'bold 45px Cairo'; x.fillStyle = '#FFD700'; x.fillText('👑 أبطال الإمبراطورية', 350, 580);
    x.font = '40px Cairo'; x.fillStyle = '#FFF';
    const medals = ['🥇', '🥈', '🥉'];
    top3.forEach((u, i) => {
      const crown = u[1].crown? ' 👑' : '';
      x.fillText(`${medals[i]} ${u[0]}: ${u[1].points}${crown}`, 350, 650 + i * 60);
    });

    // الأوامر
    x.font = 'bold 45px Cairo'; x.fillStyle = '#00BFFF'; x.fillText('⚡ أوامر الإمبراطور', 350, 860);
    x.font = '35px Cairo'; x.fillStyle = '#FFF';
    const cmds = currentMode === 'million'? ['!تفجير_الكنز', '!تلميح', '!نقاطي', '!تاجي', '!نكتة'] : ['!لغز', '!نقاطي', '!ترتيب', '!نكتة', '!تحدي'];
    cmds.forEach((cmd, i) => x.fillText(cmd, 350, 920 + i * 50));

    // الشات
    x.font = '38px Cairo';
    chatMessages.slice(-4).forEach((m, i) => {
      x.fillStyle = '#FF69B4'; x.fillText(`${m.author}:`, 1870, 860 + i * 65);
      x.fillStyle = '#FFF'; x.fillText(m.msg.substring(0, 45), 1650, 860 + i * 65);
    });

    // الفوتر
    x.fillStyle = 'rgba(0,0,0,0.95)'; x.fillRect(0, 1020, 1920, 60);
    x.font = 'bold 32px Cairo';
    const footerGradient = x.createLinearGradient(0, 0, 1920, 0);
    footerGradient.addColorStop(0, '#FFD700'); footerGradient.addColorStop(0.5, '#FF0000'); footerGradient.addColorStop(1, '#FFD700');
    x.fillStyle = footerGradient; x.textAlign = 'center';
    const next = { fajr: 'الحومة 10:00', main: 'المليون 20:00', million: 'الحومة 22:00', event: 'الحومة 22:00' };
    x.fillText(`👑 القادم: ${next[currentMode]} | تابعنا @taki-off-24 | الحومة الإمبراطورية 24/7 🔥⚡`, 960, 1060);

    return c.toBuffer('image/png');
  } catch (e) {
    console.log('خطأ في توليد الصورة:', e.message);
    const c = createCanvas(1920, 1080); return c.toBuffer('image/png');
  }
}

// === 4. FFmpeg مع preset ultrafast ===
function startFFmpeg() {
  if (ffmpegProcess) { try { ffmpegProcess.kill('SIGKILL'); } catch (e) {} }
  console.log('تشغيل FFmpeg الإمبراطور...');
  ffmpegProcess = ffmpeg()
   .input('color=c=black:s=1920x1080:r=1').inputFormat('lavfi')
   .input('pipe:0').inputOptions(['-f', 'image2pipe', '-framerate', '1', '-update', '1'])
   .complexFilter(['[0:v][1:v] overlay=0:0'])
   .outputOptions([
      '-c:v libx264',
      '-preset ultrafast', // راك طلبتو
      '-tune zerolatency',
      '-maxrate 3000k',
      '-bufsize 6000k',
      '-pix_fmt yuv420p',
      '-g 60',
      '-r 30',
      '-f flv'
    ])
   .output(`rtmp://a.rtmp.youtube.com/live2/${YT_STREAM_KEY}`)
   .on('start', () => console.log('FFmpeg بدأ البث الإمبراطوري 👑'))
   .on('error', (err) => { console.log('FFmpeg طاح:', err.message); setTimeout(startFFmpeg, 5000); })
   .on('end', () => { console.log('FFmpeg انتهى، إعادة تشغيل...'); setTimeout(startFFmpeg, 5000); });
  ffmpegProcess.run();

  setInterval(() => {
    if (currentOverlay && ffmpegProcess && ffmpegProcess.ffmpegProc) {
      try { ffmpegProcess.stdin.write(currentOverlay); } catch (e) {}
    }
  }, 1000);
}

// === الدالة الرئيسية - كل شيء هنا ===
async function main() {
  // 1. قاعدة البيانات أول شيء
  const adapter = new JSONFile('db.json');
  const db = new Low(adapter);
  await db.read();

  db.data ||= {
    users: {},
    game: { current_quiz: 'عاصمة الجزائر؟', answer: 'الجزائر', quiz_index: 0 },
    million: { secret_word: 'تكنولوجيا', hints_given: 0, treasure_found: false },
    fajr: { verse: 0, listeners: [] },
    event: { active: false }
  };
  await db.write();
  console.log('✅ قاعدة البيانات جاهزة');

  // 2. Routes تاعك - حطهم هنا
  app.get('/health', (req, res) => res.json({ status: 'ok', mode: getCurrentMode() }));

  app.get('/overlay', async (req, res) => {
    currentOverlay = await generateOverlay(db);
    res.set('Content-Type', 'image/png');
    res.send(currentOverlay);
  });

  // زيد Routes تاعك هنا...

  // 3. الكرون والـ Interval
  setInterval(updateChannelStats, 300000);
  updateChannelStats();

  setInterval(async () => {
    currentOverlay = await generateOverlay(db);
    jokeIndex++;
    motivationIndex++;
  }, 10000);

  // 4. شغل FFmpeg
  startFFmpeg();

  // 5. شغل السرفر - آخر شيء
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// شغل كلشي
main().catch(err => {
  console.error('💀 فشل تشغيل السرفر:', err);
  process.exit(1);
});