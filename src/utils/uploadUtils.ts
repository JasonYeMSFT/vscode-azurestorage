/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { basename, dirname, posix } from 'path';
import * as vscode from 'vscode';
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from '../commands/azCopy/azCopyLocations';
import { azCopyTransfer } from '../commands/azCopy/azCopyTransfer';
import { getResourceUri } from '../commands/downloadFiles/getResourceUri';
import { getSasToken } from '../commands/downloadFiles/getSasToken';
import { NotificationProgress } from '../constants';
import { ext } from '../extensionVariables';
import { TransferProgress } from '../TransferProgress';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { doesBlobDirectoryExist, doesBlobExist } from './blobUtils';
import { checkCanOverwrite } from './checkCanOverwrite';
import { copyAndShowToast } from './copyAndShowToast';
import { doesDirectoryExist } from './directoryUtils';
import { doesFileExist } from './fileUtils';
import { isEmptyDirectory } from './fs';
import { localize } from './localize';

export const upload: string = localize('upload', 'Upload');

export enum OverwriteChoice {
    yesToAll,
    yes,
    noToAll,
    no
}

export async function uploadLocalFolder(
    context: IActionContext,
    destTreeItem: BlobContainerTreeItem | FileShareTreeItem,
    sourcePath: string,
    destPath: string,
    notificationProgress: NotificationProgress,
    cancellationToken: vscode.CancellationToken,
    messagePrefix?: string,
): Promise<void> {
    const fromTo: FromToOption = destTreeItem instanceof BlobContainerTreeItem ? 'LocalBlob' : 'LocalFile';
    const uri = vscode.Uri.file(sourcePath);
    let useWildCard: boolean = true;
    if (await isEmptyDirectory(uri)) {
        useWildCard = false;
        destPath = dirname(destPath);
        if (destPath === '.') {
            destPath = '';
        }
    }

    const src: ILocalLocation = createAzCopyLocalLocation(sourcePath, useWildCard);

    const resourceUri = getResourceUri(destTreeItem);
    const sasToken = getSasToken(destTreeItem.root);
    const dst: IRemoteSasLocation = createAzCopyRemoteLocation(resourceUri, sasToken, destPath, false);
    const transferProgress: TransferProgress = new TransferProgress('files', messagePrefix);
    ext.outputChannel.appendLog(getUploadingMessageWithSource(sourcePath, destTreeItem.label));
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
}

export function getUploadingMessage(treeItemLabel: string): string {
    return localize('uploadingTo', 'Uploading to "{0}"...', treeItemLabel);
}

export function getUploadingMessageWithSource(sourcePath: string, treeItemLabel: string): string {
    return localize('uploadingFromTo', 'Uploading from "{0}" to "{1}"', sourcePath, treeItemLabel);
}

export function outputAndCopyUploadedFileUrls(parentUrl: string, fileUrls: string[]): void {
    for (const fileUrl of fileUrls) {
        const url: string = localize('uploadedFileUrl', 'Uploaded file URL: {0}', `${parentUrl}/${fileUrl}`);
        ext.outputChannel.appendLog(url);
    }

    const copyToClipboard: string = localize('copyToClipboard', 'Copy to Clipboard');
    const outputAndCopyFile: string = localize('outputAndCopyFinished.file', 'Finished uploading 1 file.');
    const outputAndCopyFiles: string = localize('outputAndCopyFinished.files', 'Finished uploading {0} files.', fileUrls.length);
    const viewOutput: string = localize('viewOutput', 'View Output');

    if (fileUrls.length === 1) {
        void vscode.window.showInformationMessage(
            outputAndCopyFile,
            copyToClipboard
        ).then(async (result) => {
            const shouldCopy: boolean = !!result;
            if (shouldCopy) {
                const lastFileUrl: string = `${parentUrl}/${fileUrls[fileUrls.length - 1]}`;
                await copyAndShowToast(lastFileUrl, 'File URL');
            }
        });
    } else {
        void vscode.window.showInformationMessage(
            outputAndCopyFiles,
            viewOutput
        ).then(result => {
            const shouldView: boolean = !!result;
            if (shouldView) {
                ext.outputChannel.show();
            }
        });
    }
}

export function showUploadSuccessMessage(treeItemLabel: string): void {
    const success: string = localize('uploadSuccess', 'Successfully uploaded to "{0}"', treeItemLabel);
    ext.outputChannel.appendLog(success);
    void vscode.window.showInformationMessage(success);
}

export async function checkCanUpload(
    context: IActionContext,
    destPath: string,
    overwriteChoice: { choice: OverwriteChoice | undefined },
    treeItem: BlobContainerTreeItem | FileShareTreeItem
): Promise<boolean> {
    return await checkCanOverwrite(context, destPath, overwriteChoice, async () => {
        if (treeItem instanceof BlobContainerTreeItem) {
            return await doesBlobExist(treeItem, destPath) || await doesBlobDirectoryExist(treeItem, destPath);
        } else {
            return await doesFileExist(basename(destPath), treeItem, dirname(destPath), treeItem.shareName) || await doesDirectoryExist(treeItem, destPath, treeItem.shareName);
        }
    });
}

export function convertLocalPathToRemotePath(localPath: string, destinationDirectory: string): string {
    let path: string = posix.join(destinationDirectory, basename(localPath));
    if (path.startsWith(posix.sep)) {
        // `BlobClient` and `ShareFileClient` treat resource paths that start with "/" differently from those that don't. So remove the leading "/".
        // This check is done after `posix.join()` because that function removes any duplicate slashes from the beginning of the path.
        path = path.substr(1);
    }
    return path;
}

export async function promptForDestinationDirectory(context: IActionContext): Promise<string> {
    return await context.ui.showInputBox({
        value: posix.sep,
        prompt: localize('destinationDirectory', 'Enter the destination directory for this upload.'),
    });
}

export async function getDestinationDirectory(context: IActionContext, destinationDirectory?: string): Promise<string> {
    return destinationDirectory !== undefined ? destinationDirectory : await promptForDestinationDirectory(context);
}
