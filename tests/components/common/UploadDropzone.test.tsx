// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadDropzone } from "@/components/common/UploadDropzone";

const acceptedExtensions = [".m4a"];
const acceptedMimeTypes = ["audio/mp4", "audio/x-m4a"];
const accept = ".m4a,audio/mp4,audio/x-m4a";
const label = "Glisse ton M4A ici ou clique pour choisir";
const rejectionMessage = "Format non supporté. Glisse un fichier `.m4a`.";

function renderDropzone(overrides: Partial<{
  onFileSelected: (file: File) => void;
  onRejected: (reason: string) => void;
  disabled: boolean;
}> = {}) {
  const onFileSelected = overrides.onFileSelected ?? vi.fn();
  const onRejected = overrides.onRejected ?? vi.fn();
  render(
    <UploadDropzone
      accept={accept}
      acceptedExtensions={acceptedExtensions}
      acceptedMimeTypes={acceptedMimeTypes}
      onFileSelected={onFileSelected}
      onRejected={onRejected}
      label={label}
      rejectionMessage={rejectionMessage}
      disabled={overrides.disabled ?? false}
    />,
  );
  return { onFileSelected, onRejected };
}

function makeDataTransfer(file: File): DataTransfer {
  return {
    files: [file] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: ["Files"],
    dropEffect: "copy",
    effectAllowed: "copy",
    clearData: vi.fn(),
    getData: vi.fn(),
    setData: vi.fn(),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
}

describe("<UploadDropzone>", () => {
  test("renders the label and the role=button affordance", () => {
    renderDropzone();
    const dropzone = screen.getByRole("button", { name: label });
    expect(dropzone).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test("clicking the dropzone triggers the hidden input click", async () => {
    renderDropzone();
    const dropzone = screen.getByRole("button", { name: label });
    const hiddenInput = dropzone.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(hiddenInput, "click").mockImplementation(() => {});

    const user = userEvent.setup();
    await user.click(dropzone);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("pressing Enter or Space on the dropzone triggers the picker", async () => {
    renderDropzone();
    const dropzone = screen.getByRole("button", { name: label });
    const hiddenInput = dropzone.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(hiddenInput, "click").mockImplementation(() => {});

    dropzone.focus();
    fireEvent.keyDown(dropzone, { key: "Enter" });
    fireEvent.keyDown(dropzone, { key: " " });

    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  test("drag-over toggles data-dragover attribute on the dropzone", () => {
    renderDropzone();
    const dropzone = screen.getByRole("button", { name: label });
    expect(dropzone.getAttribute("data-dragover")).toBeNull();

    fireEvent.dragEnter(dropzone, {
      dataTransfer: makeDataTransfer(new File([], "demo.m4a")),
    });
    expect(dropzone.getAttribute("data-dragover")).toBe("true");

    fireEvent.dragLeave(dropzone);
    expect(dropzone.getAttribute("data-dragover")).toBeNull();
  });

  test("dropping a valid M4A calls onFileSelected", () => {
    const onFileSelected = vi.fn();
    const onRejected = vi.fn();
    renderDropzone({ onFileSelected, onRejected });
    const dropzone = screen.getByRole("button", { name: label });
    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(onRejected).not.toHaveBeenCalled();
  });

  test("dropping a file with the right extension but missing MIME still passes", () => {
    const onFileSelected = vi.fn();
    renderDropzone({ onFileSelected });
    const dropzone = screen.getByRole("button", { name: label });
    const file = new File(["x"], "demo.M4A", { type: "" });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  test("dropping a non-M4A file calls onRejected with the rejection message", () => {
    const onFileSelected = vi.fn();
    const onRejected = vi.fn();
    renderDropzone({ onFileSelected, onRejected });
    const dropzone = screen.getByRole("button", { name: label });
    const file = new File(["x"], "demo.txt", { type: "text/plain" });

    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });

    expect(onRejected).toHaveBeenCalledWith(rejectionMessage);
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  test("disabled dropzone ignores both click and drop", async () => {
    const onFileSelected = vi.fn();
    renderDropzone({ onFileSelected, disabled: true });
    const dropzone = screen.getByRole("button", { name: label });
    const hiddenInput = dropzone.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(hiddenInput, "click").mockImplementation(() => {});

    const user = userEvent.setup();
    await user.click(dropzone);
    expect(clickSpy).not.toHaveBeenCalled();

    const file = new File(["x"], "demo.m4a", { type: "audio/mp4" });
    fireEvent.drop(dropzone, { dataTransfer: makeDataTransfer(file) });
    expect(onFileSelected).not.toHaveBeenCalled();

    expect(dropzone.getAttribute("aria-disabled")).toBe("true");
  });
});
