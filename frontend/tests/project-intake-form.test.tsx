import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProjectIntakeForm } from "@/components/projects/project-intake-form";

describe("ProjectIntakeForm", () => {
  it("submits upload and url modes through dedicated callbacks", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const onImport = vi.fn().mockResolvedValue(undefined);

    render(<ProjectIntakeForm onImportUrl={onImport} onUploadFile={onUpload} />);

    await user.type(screen.getByLabelText(/project name/i), "Clip upload");
    await user.upload(
      screen.getByLabelText(/video file/i),
      new File(["video"], "clip.mp4", { type: "video/mp4" })
    );
    await user.click(screen.getByRole("button", { name: /add upload to library/i }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    expect(onUpload.mock.calls[0][0]).toBe("Clip upload");
    expect(onUpload.mock.calls[0][1]).toBeInstanceOf(File);
    expect(onUpload.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        sourceLanguage: "en",
        targetLanguage: "pl",
        geminiModelText: "gemini-2.5-flash-lite",
        geminiThinkingMode: "off",
        geminiMaxOutputTokens: 65536,
        geminiStructuredOutput: true
      })
    );

    await user.click(screen.getByRole("button", { name: /remote ingest/i }));
    await user.selectOptions(screen.getByLabelText(/source language/i), "auto");
    await user.selectOptions(screen.getByLabelText(/target language/i), "en");
    await user.selectOptions(screen.getByLabelText("Gemini model"), "gemini-2.5-flash");
    await user.selectOptions(screen.getByLabelText("Gemini thinking"), "budget");
    await user.clear(screen.getByLabelText("Gemini thinking budget"));
    await user.type(screen.getByLabelText("Gemini thinking budget"), "2048");
    await user.clear(screen.getByLabelText("Gemini max output tokens"));
    await user.type(screen.getByLabelText("Gemini max output tokens"), "65536");
    await user.clear(screen.getByLabelText(/project name/i));
    await user.type(screen.getByLabelText(/project name/i), "Remote clip");
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /import link to library/i }));

    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith(
        "Remote clip",
        "https://example.com/video",
        expect.objectContaining({
          sourceLanguage: "auto",
          targetLanguage: "en",
          geminiModelText: "gemini-2.5-flash",
          geminiThinkingMode: "budget",
          geminiThinkingBudget: 2048,
          geminiMaxOutputTokens: 65536,
          geminiStructuredOutput: true
        })
      )
    );
  });
});
