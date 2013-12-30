/// <reference path="references.ts" />
/// <reference path="io.ts" />

module TypeScript {
    export class StandardResolverHost implements ITopLevelImportResolverHost {
        constructor(private ioHost: IIO) {
            this.ioHost = this.ioHost || IO;
        }

        resolveRelativePath(path: string, directory: string): string {
            var start = new Date().getTime();

            var unQuotedPath = stripStartAndEndQuotes(path);
            var normalizedPath: string;

            if (isRooted(unQuotedPath) || !directory) {
                normalizedPath = unQuotedPath;
            } else {
                normalizedPath = IOUtils.combine(directory, unQuotedPath);
            }

            // get the absolute path
            normalizedPath = this.resolvePath(normalizedPath);

            // Switch to forward slashes
            normalizedPath = switchToForwardSlashes(normalizedPath);

            return normalizedPath;
        }

        private fileExistsCache = createIntrinsicsObject<boolean>();

        fileExists(path: string): boolean {
            var exists = this.fileExistsCache[path];
            if (exists === undefined) {
                var start = new Date().getTime();
                exists = this.ioHost.fileExists(path);
                this.fileExistsCache[path] = exists;
                TypeScript.compilerFileExistsTime += new Date().getTime() - start;
            }

            return exists;
        }

        getParentDirectory(path: string): string {
            var start = new Date().getTime();
            var result = this.ioHost.dirName(path);
            TypeScript.compilerDirectoryNameTime += new Date().getTime() - start;

            return result;
        }

        // For performance reasons we cache the results of resolvePath.  This avoids costly lookup
        // on the disk once we've already resolved a path once.
        private resolvePathCache = createIntrinsicsObject<string>();

        resolvePath(path: string): string {
            var cachedValue = this.resolvePathCache[path];
            if (!cachedValue) {
                var start = new Date().getTime();
                cachedValue = this.ioHost.resolvePath(path);
                this.resolvePathCache[path] = cachedValue;
                TypeScript.compilerResolvePathTime += new Date().getTime() - start;
            }

            return cachedValue;
        }
    }

    export interface ITopLevelImportResolverHost {
        resolveRelativePath(path: string, directory: string): string;
        fileExists(path: string): boolean;
        getParentDirectory(path: string): string;
    }

    export interface ITopLevelImportResolver {
        resolvePath(referencingModulePath: string, moduleIdentifier: string): string;
    }

    class TopLevelImportResolver implements ITopLevelImportResolver {
        constructor(private host: ITopLevelImportResolverHost) {
        }

        resolvePath(referencingModulePath: string, moduleIdentifier: string): string {
            TypeScript.Debug.assert(!isRelative(moduleIdentifier), "Relative paths should not get to the module path resolver");
            TypeScript.Debug.assert(!isRooted(moduleIdentifier), "Rooted paths should not get to the module path resolver");

            // Search for the file
            var parentDirectory = this.host.getParentDirectory(referencingModulePath);
            var searchFilePath: string = null;
            var dtsFileName = moduleIdentifier + ".d.ts";
            var tsFilePath = moduleIdentifier + ".ts";

            var start = new Date().getTime();

            do {
                // Search for ".d.ts" file firs
                var currentFilePath = this.host.resolveRelativePath(dtsFileName, parentDirectory);
                if (this.host.fileExists(currentFilePath)) {
                    // Found the file
                    searchFilePath = currentFilePath;
                    break;
                }

                // Search for ".ts" file
                currentFilePath = this.host.resolveRelativePath(tsFilePath, parentDirectory);
                if (this.host.fileExists(currentFilePath)) {
                    // Found the file
                    searchFilePath = currentFilePath;
                    break;
                }

                parentDirectory = this.host.getParentDirectory(parentDirectory);
            }
            while (parentDirectory);

            TypeScript.fileResolutionImportFileSearchTime += new Date().getTime() - start;

            return searchFilePath;
        }
    }

    class DirectoryResolverWithCache implements ITopLevelImportResolver {
        private modules = new StringHashTable<string>();

        constructor(private resolver: ITopLevelImportResolver) {
        }

        resolvePath(referencingModulePath: string, moduleIdentifier: string): string {
            var modulePath = this.modules.lookup(moduleIdentifier);

            if (!modulePath) {
                modulePath = this.resolver.resolvePath(referencingModulePath, moduleIdentifier);
                this.modules.add(moduleIdentifier, modulePath);
            }

            return modulePath;
        }
    }

    export class TopLevelImportResolverWithCache implements ITopLevelImportResolver {
        private directories = new StringHashTable<DirectoryResolverWithCache>();
        private resolver: ITopLevelImportResolver;

        constructor(private host: ITopLevelImportResolverHost) {
            this.resolver = new TopLevelImportResolver(host);
        }

        resolvePath(referencingModulePath: string, moduleIdentifier: string): string {
            var directoryPath = this.host.getParentDirectory(referencingModulePath);
            var directoryResolver = this.directories.lookup(directoryPath);

            if (!directoryResolver) {
                directoryResolver = new DirectoryResolverWithCache(this.resolver);
                this.directories.add(directoryPath, directoryResolver);
            }

            return directoryResolver.resolvePath(referencingModulePath, moduleIdentifier);
        }
    }
}