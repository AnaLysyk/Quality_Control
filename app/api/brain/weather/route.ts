import { NextResponse } from "next/server";

type WeatherPayload = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

function toNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function weatherLabel(code: number | null) {
  if (code === null) return "tempo não identificado";
  if (code === 0) return "céu limpo";
  if ([1, 2, 3].includes(code)) return "parcialmente nublado";
  if ([45, 48].includes(code)) return "neblina";
  if ([51, 53, 55, 56, 57].includes(code)) return "garoa";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "chuva";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "neve";
  if ([95, 96, 99].includes(code)) return "trovoadas";
  return "tempo instável";
}

function buildWeatherComment(input: { temperature: number | null; apparentTemperature: number | null; label: string; precipitation: number | null }) {
  const temp = input.temperature !== null ? `${Math.round(input.temperature)}°C` : "temperatura indisponível";
  const feels = input.apparentTemperature !== null ? `, sensação de ${Math.round(input.apparentTemperature)}°C` : "";
  const rain = input.precipitation && input.precipitation > 0 ? " Tem sinal de chuva, então melhor deixar o plano B no bolso." : "";
  return `Também dei uma olhada no tempo da sua região: ${input.label}, ${temp}${feels}.${rain} Brain com previsão do tempo e radar de bugs ligados 😄`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = toNumber(url.searchParams.get("lat"));
  const lon = toNumber(url.searchParams.get("lon"));

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "Latitude e longitude são obrigatórias." }, { status: 400 });
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(lat));
  weatherUrl.searchParams.set("longitude", String(lon));
  weatherUrl.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
  weatherUrl.searchParams.set("timezone", "auto");

  const weatherResponse = await fetch(weatherUrl, { cache: "no-store" });
  if (!weatherResponse.ok) {
    return NextResponse.json({ error: "Não foi possível consultar o clima agora." }, { status: 502 });
  }

  const weather = (await weatherResponse.json().catch(() => null)) as WeatherPayload | null;
  const current = weather?.current;
  const code = typeof current?.weather_code === "number" ? current.weather_code : null;
  const label = weatherLabel(code);
  const temperature = typeof current?.temperature_2m === "number" ? current.temperature_2m : null;
  const apparentTemperature = typeof current?.apparent_temperature === "number" ? current.apparent_temperature : null;
  const precipitation = typeof current?.precipitation === "number" ? current.precipitation : null;

  return NextResponse.json({
    place: "sua região",
    temperature,
    apparentTemperature,
    humidity: typeof current?.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
    precipitation,
    windSpeed: typeof current?.wind_speed_10m === "number" ? current.wind_speed_10m : null,
    weatherCode: code,
    label,
    comment: buildWeatherComment({ temperature, apparentTemperature, label, precipitation }),
    source: "open-meteo",
  });
}
