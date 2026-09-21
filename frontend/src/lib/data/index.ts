import { HttpContentRepository } from "./http/http-content-repository";
import { HttpSubmissionRepository } from "./http/http-submission-repository";
import { MockChatRepository } from "./mock/mock-chat-repository";
import { MockContentRepository } from "./mock/mock-content-repository";
import { MockSubmissionRepository } from "./mock/mock-submission-repository";

const dataSource = import.meta.env.PUBLIC_DATA_SOURCE ?? "mock";
const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL ?? "";

export const contentRepository =
  dataSource === "http"
    ? new HttpContentRepository(apiBaseUrl)
    : new MockContentRepository();

export const submissionRepository =
  dataSource === "http"
    ? new HttpSubmissionRepository(apiBaseUrl)
    : new MockSubmissionRepository();

// Sin variante HTTP: el chat es una demo local tipo FAQ, sin endpoint
// planeado (ver backend/README.md).
export const chatRepository = new MockChatRepository();
