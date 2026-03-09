export const PORT_DATA = {
    'Dalian': { country: 'China', coords: '38.9140° N, 121.6147° E' },
    'Hakata': { country: 'Japan', coords: '33.6066° N, 130.4181° E' },
    'Kawasaki': { country: 'Japan', coords: '35.5308° N, 139.7029° E' },
    'Kobe': { country: 'Japan', coords: '34.6901° N, 135.1955° E' },
    'Yokohama': { country: 'Japan', coords: '35.4437° N, 139.6380° E' },
    'Nagoya': { country: 'Japan', coords: '35.0519° N, 136.8787° E' },
    'Qingdao': { country: 'China', coords: '36.0671° N, 120.3826° E' },
    'Shanghai': { country: 'China', coords: '31.2304° N, 121.4737° E' },
    'Shekou': { country: 'China', coords: '22.4844° N, 113.9189° E' },
    'Xingang': { country: 'China', coords: '38.9842° N, 117.7600° E' },
    'Dammam, Saudi Arabia': { country: 'Saudi Arabia', coords: '26.4207° N, 50.0888° E' },
    'Jebbel Ali': { country: 'United Arab Emirates', coords: '24.9857° N, 55.0711° E' },
    'Qatar': { country: 'Qatar', coords: '25.2854° N, 51.5310° E' }
};

/**
 * Gets enhanced destination string including country and coordinates
 * @param {string} destination - The port name
 * @returns {string} - Formatted destination metadata
 */
export const getEnhancedDestination = (destination) => {
    if (!destination) return 'Pending';

    // Check for exact match or partial match (since some might include city, country)
    const portKey = Object.keys(PORT_DATA).find(key =>
        destination.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(destination.toLowerCase())
    );

    if (portKey) {
        const data = PORT_DATA[portKey];
        return `${destination}, ${data.country} [${data.coords}]`;
    }

    return destination;
};

/**
 * Gets just the country for a destination
 * @param {string} destination 
 * @returns {string}
 */
export const getPortCountry = (destination) => {
    if (!destination) return '';
    const portKey = Object.keys(PORT_DATA).find(key =>
        destination.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(destination.toLowerCase())
    );
    return portKey ? PORT_DATA[portKey].country : '';
};
