import { toHijri } from 'hijri-converter';

export const getHijriDate = (gregorianDate: Date = new Date()): string => {
  const year = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1;
  const day = gregorianDate.getDate();
  
  try {
    const hijri = toHijri(year, month, day);
    const months = [
      'Muharram',
      'Safar',
      'Rabi\' al-awwal',
      'Rabi\' al-thani',
      'Jumada al-awwal',
      'Jumada al-thani',
      'Rajab',
      'Sha\'ban',
      'Ramadan',
      'Shawwal',
      'Dhu al-Qi\'dah',
      'Dhu al-Hijjah'
    ];
    
    return `${hijri.hd} ${months[hijri.hm - 1]} ${hijri.hy} AH`;
  } catch (error) {
    console.error('Error converting to Hijri:', error);
    return '';
  }
};

export const getHijriDateShort = (gregorianDate: Date = new Date()): string => {
  const year = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1;
  const day = gregorianDate.getDate();
  
  try {
    const hijri = toHijri(year, month, day);
    // hijri-converter returns { hy, hm, hd }
    if (hijri && typeof hijri === 'object') {
      const hDay = hijri.hd ?? '';
      const hMonth = hijri.hm ?? '';
      const hYear = hijri.hy ?? '';
      
      if (hDay && hMonth && hYear) {
        return `${hDay}/${hMonth}/${hYear}`;
      }
    }
    console.error('Invalid hijri conversion result:', hijri);
    return '';
  } catch (error) {
    console.error('Error converting to Hijri:', error);
    return '';
  }
};

