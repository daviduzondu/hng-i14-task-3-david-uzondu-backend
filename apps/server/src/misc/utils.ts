import type { profileQuerySchema } from "@/schema/profile-query.schema";
import type z from "zod";
import parse from 'compromise';
import countryCodeMapping from "@/lookup/country-code.lookup.json";
import profileQueryNlpMapping from "@/lookup/profile-query-nlp.lookup.json";
import type View from "compromise/view/one";
import { AppError } from "@/errors/app.error";

export function parseSearchQuery(text: string) {
 const normalizedInput = text.toLowerCase()
 const doc = parse(normalizedInput);
 const youngMatch = doc.matchOne("young");
 const betweenMatch = doc.matchOne("between (age| the age of | the ages of)?  [#Value] (and|to) [#Value]");
 const countryMatch = countryCodeMapping.countries.map(c => c.name).find(c => doc.has(c.toLowerCase()));
 const hasMatch = (values: string[]) =>
  values.some(v => {
   return doc.clone().has(v)
  })

 const matchEnum = <T extends string>(map: Record<T, string[]>): T | null => {
  for (const [key, values] of Object.entries(map) as [T, string[]][]) {
   if (hasMatch(values)) return key
  }
  return null
 }

 const extractNumber = (patterns: string[]): number | null => {
  for (const pattern of patterns) {
   const match = doc.matchOne(pattern);
   if (match.found) {
    const num = match.matchOne('#Value').text()
    if (num) return parseFloat(num)
   }
  }
  return null
 }


 return {
  gender: matchEnum(profileQueryNlpMapping.gender),
  country_id: !!countryMatch ? countryCodeMapping.countries.find(c => c.name === countryMatch)?.code : null,
  age_group: youngMatch.found ? null : matchEnum(profileQueryNlpMapping.age_group),
  min_age: youngMatch.found ? 16 : betweenMatch.found ? parseFloat((betweenMatch.groups('0') as View).text()) : extractNumber(profileQueryNlpMapping.min_age),
  max_age: youngMatch.found ? 24 : betweenMatch.found ? parseFloat((betweenMatch.groups('1') as View).text()) : extractNumber(profileQueryNlpMapping.max_age),
  min_gender_probability: extractNumber(profileQueryNlpMapping.min_gender_probability),
  min_country_probability: extractNumber(profileQueryNlpMapping.min_country_probability),
  order: matchEnum(profileQueryNlpMapping.order),
  sort_by: matchEnum(profileQueryNlpMapping.sort_by)
 } satisfies z.infer<typeof profileQuerySchema>
}



type ErrorConstructor = new (...args: any[]) => Error;

type ErrorMap = Record<string, {
 errorClass: ErrorConstructor,
 message: string,
 code: number
}>

export async function catchAndThrowError<T>(fn: () => Promise<T>, errorMap: ErrorMap) {
 try {
  const result = await fn();
  return result;
 } catch (error) {
  Object.values(errorMap).forEach(map => {
   if (error instanceof map.errorClass) {
    throw new AppError({ message: map.message, code: map.code })
   }
  });
  throw new Error("Something went wrong!")
 }
}












// const hasMatch = (values: string[]) =>
//  values.some(v => {
//   const plural = parse(v).nouns().toPlural().text()
//   return (
//    normalizedInput.includes(v) ||
//    (plural !== v && normalizedInput.includes(plural))
//   )
//  })