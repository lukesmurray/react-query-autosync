/**
 * Function used to merge server data with local modification of server data
 */

export type MergeFunc<TQueryData> = (remote: TQueryData, local: TQueryData) => TQueryData;
