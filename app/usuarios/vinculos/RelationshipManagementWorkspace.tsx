"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import RelationshipHistoryByCompanyPanel from "./RelationshipHistoryByCompanyPanel";
import RelationshipManagementClientV4 from "./RelationshipManagementClientV4";

const RELATIONSHIP_CHANGED_EVENT = "qc:relationships-changed";

function clearRelationshipAuthCache() {
  try {
    sessionStorage.removeItem("qc:auth_me:v1");