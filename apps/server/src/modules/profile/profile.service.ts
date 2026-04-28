import { AppError } from "@/errors/app.error";
import {
  createNewProfile,
  deleteProfileById,
  filterProfiles,
  findProfileById,
  findProfileByName,
} from "@/modules/profile/profile.repository";
import { catchAndThrowError, parseSearchQuery } from "@/misc/utils";
import {
  profileQuerySchema,
  profileSearchSchema,
} from "@/schema/profile-query.schema";
import type {
  AgifyResponse,
  ErrorResponse,
  GenderizeResponse,
  NationalizeResponse,
  SuccessResponse,
} from "@/misc/types";
import type { AxiosResponse } from "axios";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import z from "zod";
import { NoResultError } from "kysely";

type StandardServiceResponse = Promise<{
  statusCode: number;
  body?: SuccessResponse | ErrorResponse;
}>;

export async function createProfile(name: string): StandardServiceResponse {
  const [genderRes, agifyRes, nationalizeRes]: [
    AxiosResponse<GenderizeResponse>,
    AxiosResponse<AgifyResponse>,
    AxiosResponse<NationalizeResponse>,
  ] = await Promise.all([
    axios.get(`https://api.genderize.io/?name=${name}`),
    axios.get(`https://api.agify.io/?name=${name}`),
    axios.get(`https://api.nationalize.io/?name=${name}`),
  ]);

  if (
    genderRes.status !== 200 ||
    agifyRes.status !== 200 ||
    nationalizeRes.status !== 200
  )
    throw new AppError({
      message: `${genderRes.status !== 200 ? "Genderize" : agifyRes.status !== 200 ? "Agify" : nationalizeRes.status !== 200 ? "Nationalize" : "classification"} returned an invalide response`,
      code: 502,
    });

  const existingUser = await findProfileByName(name);
  delete existingUser?.updated_at;

  if (existingUser) {
    return {
      statusCode: StatusCodes.OK,
      body: {
        message: "Profle already exists",
        data: existingUser,
        status: "success",
      },
    };
  }

  if (
    genderRes.data.count === 0 ||
    genderRes.data.gender === null ||
    !agifyRes.data.age ||
    nationalizeRes.data.country.length === 0
  ) {
    return {
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      body: {
        status: "error",
        message: "No prediction available for the provided name",
      },
    };
  }
  const newProfile = await createNewProfile({
    age: agifyRes.data.age,
    // count: agifyRes.data.count,
    country: nationalizeRes.data.country.reduce((a, b) =>
      a.probability > b.probability ? a : b,
    ).country_id,
    gender: genderRes.data.gender,
    name,
    gender_probability: genderRes.data.probability,
    country_probability: Math.max(
      ...nationalizeRes.data.country.map((c) => c.probability),
    ),
  });
  delete newProfile.updated_at;

  return {
    statusCode: StatusCodes.CREATED,
    body: {
      status: "success",
      data: newProfile,
    },
  };
}

export async function searchProfiles(
  payload: z.infer<typeof profileSearchSchema>,
): StandardServiceResponse {
  const parsedPayload = z.parse(profileSearchSchema, payload);
  const query = parseSearchQuery(parsedPayload.q);
  const offset = (parsedPayload.page - 1) * Number(parsedPayload.limit);
  if (Object.values(query).every((entry) => entry === null))
    return {
      body: {
        status: "error",
        message: "Unable to interpret query",
      },
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const result = await filterProfiles({
    ...query,
    limit: parsedPayload.limit,
    page: parsedPayload.page,
    offset: offset,
  });

  return {
    body: {
      // count: result.length,
      page: parsedPayload.page,
      limit: parsedPayload.limit,
      total: Number(result[0]?.total ? result[0]?.total : 0) ,
      data: result.map((r) => ({
        age: r.age,
        age_group: r.age_group,
        country_id: r.country_id,
        id: r.id,
        name: r.name,
        gender: r.gender,
        created_at: r.created_at,
        gender_probability: r.gender_probability,
        country_probability: r.country_probability,
        country_name: r.country_name,
      })),
      status: "success",
    },
    statusCode: StatusCodes.OK,
  };
}

export async function getProfileById(id: string): StandardServiceResponse {
  const result = await catchAndThrowError(() => findProfileById(id), {
    noResult: {
      errorClass: NoResultError,
      code: StatusCodes.NOT_FOUND,
      message: "Failed to get profile",
    },
  });
  delete result.updated_at;

  return {
    body: {
      data: result,
      status: "success",
    },
    statusCode: StatusCodes.OK,
  };
}

export async function getProfiles(
  query: z.infer<typeof profileQuerySchema>,
): StandardServiceResponse {
  const parsedQuery = z.parse(profileQuerySchema, query);
  const offset = (parsedQuery.page - 1) * parsedQuery.limit;

  const result = await filterProfiles({
    ...query,
    offset,
    page: parsedQuery.page,
  });

  return {
    body: {
      page: parsedQuery.page,
      limit: parsedQuery.limit,
      data: result.map(
        (r) =>
          ({ ...r, updated_at: undefined, total: undefined }) as Partial<
            typeof r
          >,
      ),
      total: Number(result[0]?.total ? result[0]?.total : 0) ,
      // total: Number(result[0]?.total ?? 0) ?? 0,
      status: "success",
    },
    statusCode: StatusCodes.OK,
  };
}

export async function deleteProfile(id: string): StandardServiceResponse {
  await catchAndThrowError(() => deleteProfileById(id), {
    noResultError: {
      errorClass: NoResultError,
      code: StatusCodes.NOT_FOUND,
      message: "Failed to delete profile with ID",
    },
  });
  return {
    statusCode: StatusCodes.NO_CONTENT,
  };
}
