/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { Uri } from "vscode";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { IAzCopyResolution } from "../azCopy/IAzCopyResolution";

export interface IUploadFilesWizardContext extends IActionContext, ExecuteActivityContext {
    calledFromUploadToAzureStorage: boolean;
    destinationDirectory?: string;
    resolution?: IAzCopyResolution;
    treeItem?: BlobContainerTreeItem | FileShareTreeItem;
    uris?: Uri[];
}
