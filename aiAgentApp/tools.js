// tools.js

import { tool } from '@langchain/core/tools';
import * as z from 'zod';

// Weather Tool
const weatherTool = tool(
  async ({ location }) => {
    const data = [
      {
        city: "San Francisco",
        temperature: "15°C",
        condition: "Partly Cloudy",
        forecast: [
          { day: "Today", temperature: "16°C", condition: "Sunny" },
          { day: "Tomorrow", temperature: "17°C", condition: "Partly Cloudy" },
        ],
      },
      {
        city: "New York",
        temperature: "20°C",
        condition: "Sunny",
        forecast: [
          { day: "Today", temperature: "21°C", condition: "Sunny" },
          { day: "Tomorrow", temperature: "22°C", condition: "Partly Cloudy" },
        ],
      },
      {
        city: "Los Angeles",
        temperature: "25°C",
        condition: "Sunny",
        forecast: [
          { day: "Today", temperature: "26°C", condition: "Sunny" },
          { day: "Tomorrow", temperature: "27°C", condition: "Partly Cloudy" },
        ],
      },
      {
        city: "Chicago",
        temperature: "10°C",
        condition: "Cloudy",
        forecast: [
          { day: "Today", temperature: "11°C", condition: "Cloudy" },
          { day: "Tomorrow", temperature: "12°C", condition: "Rain" },
        ],
      },
    ];

    const query = location.toLowerCase().trim();
    const match = data.find(d => d.city.toLowerCase().includes(query));

    if (match) {
      // Format the weather information as a string to return to Langchain
      const weatherInfo = `
        The current weather in ${match.city} is ${match.temperature} with ${match.condition}.
        Forecast for the next two days:
        - Today: ${match.forecast[0].temperature}, ${match.forecast[0].condition}
        - Tomorrow: ${match.forecast[1].temperature}, ${match.forecast[1].condition}
      `;
      return weatherInfo;
    }

    return "Sorry, I couldn't find the weather for that location.";
  },
  {
    name: "get_current_weather",
    description: "Get current weather for a city (case-insensitive, partial match supported)",
    schema: z.object({ location: z.string() }),
  }
);
// Add Tool
const addTool = tool(async ({ a, b }) => {
  return Number(a) + Number(b);
}, {
  name: 'add_two_numbers',
  description: 'Add two numbers',
  schema: z.object({ a: z.number(), b: z.number() })
});

export { weatherTool, addTool };
