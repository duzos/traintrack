// TEMPORARY UNTIL I CODE MY OWN BACKEND

import { TrainPosition } from "../App";


interface Location {
    lat: number;
    lon: number;
}

// https://docs.signalbox.io/docs#/operations/Train-Locations_train_location_multi
interface SignalBoxData {
    delay: number; // The number of minutes delayed the train is currently running.
    location: Location; // An object describing the geographical location of the train service at the time of the request.
    predicted_location: Location; // An object describing the predicted geogrphical location of the train service 
    predicted_ts: string; // Timestamp in ISO format indicating the time at which the predicted location is predicted for. Only included if the predict request parameter was set.
    rid: string; // The Darwin RID for the train service this object describes.
    toc_code: string; // The two letter ATOC code for the train operator.
    ts: string; // Timestamp in ISO format indicating the timestamp to which the location data corresponds.
}

export async function fetchData(): Promise<SignalBoxData[]> {
  try {
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const targetUrl = 'https://map-api.production.signalbox.io/api/locations';
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
       
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    const parsedData = JSON.parse(result.contents);
    
    const data: SignalBoxData[] = parsedData.train_locations;
    return data;
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
}

export async function getTrainPositions(): Promise<TrainPosition[]> {
    const data = await fetchData();
    return data.map(item => ({
        id: item.rid,
        lat: item.location.lat,
        lng: item.location.lon,
        delay: item.delay,
        heading: 0,
        speed: 0,
        service: '',
        operator: item.toc_code,
        destination: ''
    }));
}