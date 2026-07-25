
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('pawfriends_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('pawfriends_device_id', deviceId);
  }
  return deviceId;
};

export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let device_type = "Desktop"; // Default

  // Detect Browser
  if (userAgent.match(/chrome|chromium|crios/i)) browser = "Chrome";
  else if (userAgent.match(/firefox|fxios/i)) browser = "Firefox";
  else if (userAgent.match(/safari/i)) browser = "Safari";
  else if (userAgent.match(/opr\//i)) browser = "Opera";
  else if (userAgent.match(/edg/i)) browser = "Edge";

  // Detect OS
  if (userAgent.indexOf("Win") !== -1) os = "Windows";
  else if (userAgent.indexOf("Mac") !== -1) os = "MacOS";
  else if (userAgent.indexOf("Linux") !== -1) os = "Linux";
  else if (userAgent.indexOf("Android") !== -1) os = "Android";
  else if (userAgent.indexOf("like Mac") !== -1) os = "iOS";

  // Detect Device Type
  const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)os|Opera M(obi|ini)/.test(userAgent);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent);
  
  if (isTablet) device_type = 'Tablet';
  else if (isMobile) device_type = 'Mobile';

  return {
      os,
      browser,
      device_type,
      name: `${os} - ${browser}`
  };
};

// Fetch IP and Location from a free public API
export const getNetworkInfo = async (): Promise<{ ip: string, location: string }> => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return {
            ip: data.ip || 'Unknown IP',
            location: `${data.city}, ${data.region_code || data.country_name}`
        };
    } catch (error) {
        console.warn("Could not fetch IP/Location:", error);
        return { ip: 'Unknown IP', location: 'Unknown Location' };
    }
};

export const getDeviceName = (): string => {
    const info = getDeviceInfo();
    return info.name;
};