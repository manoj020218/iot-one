import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GooglePrimaryAction } from "./GooglePrimaryAction";

describe("GooglePrimaryAction", () => {
  afterEach(() => {
    cleanup();
    delete (
      window as Window & {
        Capacitor?: unknown;
      }
    ).Capacitor;
  });

  it("uses normal click on web", () => {
    const onPress = vi.fn().mockResolvedValue(undefined);

    render(<GooglePrimaryAction onPress={onPress} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("fires on swipe inside the native shell", () => {
    (
      window as Window & {
        Capacitor?: unknown;
      }
    ).Capacitor = {};

    const onPress = vi.fn().mockResolvedValue(undefined);
    render(<GooglePrimaryAction onPress={onPress} />);

    const track = screen.getByTestId("google-swipe-track");
    const thumb = screen.getByTestId("google-swipe-thumb");

    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 60,
        height: 60,
        left: 0,
        right: 284,
        top: 0,
        width: 284,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        }
      })
    });

    fireEvent.mouseDown(thumb, { clientX: 20 });
    fireEvent.mouseMove(track, { clientX: 240 });
    fireEvent.mouseUp(track, { clientX: 240 });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
