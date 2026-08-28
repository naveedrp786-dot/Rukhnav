import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  API_BASE_URL,
} from "../config/api";

export type WebsiteTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  heading: string;
  muted: string;
  shade1: string;
  shade2: string;
  shade3: string;
  shade4: string;
};

const fallbackTheme: WebsiteTheme = {
  primary: "#173f2b",
  secondary: "#e5b83d",
  accent: "#f4ead2",
  background: "#f7f4ec",
  surface: "#ffffff",
  text: "#1f2a24",
  heading: "#1f2a24",
  muted: "#6f776f",
  shade1: "#123725",
  shade2: "#4d6330",
  shade3: "#e1bf68",
  shade4: "#f8f2e4",
};

const WebsiteThemeContext =
  createContext<WebsiteTheme>(
    fallbackTheme
  );

function cleanColor(
  value: unknown,
  fallback: string
) {
  return typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

export function WebsiteThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setTheme] =
    useState<WebsiteTheme>(
      fallbackTheme
    );

  useEffect(() => {
    let active = true;

    async function loadTheme() {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/website/settings`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `Theme request failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        const settings =
          data?.settings ||
          data?.data ||
          data ||
          {};

        const remote =
          settings?.theme ||
          {};

        if (!active) {
          return;
        }

        setTheme({
          primary: cleanColor(
            remote.primary_color,
            fallbackTheme.primary
          ),

          secondary: cleanColor(
            remote.secondary_color,
            fallbackTheme.secondary
          ),

          accent: cleanColor(
            remote.accent_color,
            fallbackTheme.accent
          ),

          background: cleanColor(
            remote.background_color,
            fallbackTheme.background
          ),

          surface: cleanColor(
            remote.surface_color,
            fallbackTheme.surface
          ),

          text: cleanColor(
            remote.text_color,
            fallbackTheme.text
          ),

          heading: cleanColor(
            remote.heading_color,
            fallbackTheme.heading
          ),

          muted: cleanColor(
            remote.muted_color,
            fallbackTheme.muted
          ),

          shade1: cleanColor(
            remote.shade_1,
            fallbackTheme.shade1
          ),

          shade2: cleanColor(
            remote.shade_2,
            fallbackTheme.shade2
          ),

          shade3: cleanColor(
            remote.shade_3,
            fallbackTheme.shade3
          ),

          shade4: cleanColor(
            remote.shade_4,
            fallbackTheme.shade4
          ),
        });
      } catch (error) {
        console.warn(
          "Unable to load RUKHNAV website theme.",
          error
        );
      }
    }

    void loadTheme();

    return () => {
      active = false;
    };
  }, []);

  const value =
    useMemo(
      () => theme,
      [theme]
    );

  return (
    <WebsiteThemeContext.Provider
      value={value}
    >
      {children}
    </WebsiteThemeContext.Provider>
  );
}

export function useWebsiteTheme() {
  return useContext(
    WebsiteThemeContext
  );
}
