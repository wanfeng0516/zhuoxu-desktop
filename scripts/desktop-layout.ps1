param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('capture', 'arrange', 'restore')]
    [string]$Action,
    [string]$PayloadPath = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$source = @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

[ComImport, Guid("6D5140C1-7436-11CE-8034-00AA006009FA"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IServiceProvider
{
    [PreserveSig] int QueryService(ref Guid service, ref Guid iid, out IntPtr result);
}

[ComImport, Guid("000214E2-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IShellBrowser
{
    [PreserveSig] int GetWindow(out IntPtr window);
    [PreserveSig] int ContextSensitiveHelp(bool enterMode);
    [PreserveSig] int InsertMenusSB(IntPtr menu, IntPtr widths);
    [PreserveSig] int SetMenuSB(IntPtr menu, IntPtr holeMenu, IntPtr activeWindow);
    [PreserveSig] int RemoveMenusSB(IntPtr menu);
    [PreserveSig] int SetStatusTextSB(IntPtr text);
    [PreserveSig] int EnableModelessSB(bool enable);
    [PreserveSig] int TranslateAcceleratorSB(IntPtr message, ushort id);
    [PreserveSig] int BrowseObject(IntPtr idList, uint flags);
    [PreserveSig] int GetViewStateStream(uint mode, out IntPtr stream);
    [PreserveSig] int GetControlWindow(uint id, out IntPtr window);
    [PreserveSig] int SendControlMsg(uint id, uint message, IntPtr wParam, IntPtr lParam, out IntPtr result);
    [PreserveSig] int QueryActiveShellView(out IntPtr shellView);
}

[ComImport, Guid("1AF3A467-214F-4298-908E-06B03E0B39F9"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IFolderView2
{
    [PreserveSig] int GetCurrentViewMode(out uint mode);
    [PreserveSig] int SetCurrentViewMode(uint mode);
    [PreserveSig] int GetFolder(ref Guid iid, out IntPtr value);
    [PreserveSig] int Item(int index, out IntPtr item);
    [PreserveSig] int ItemCount(uint flags, out int count);
    [PreserveSig] int Items(uint flags, ref Guid iid, out IntPtr items);
    [PreserveSig] int GetSelectionMarkedItem(out int item);
    [PreserveSig] int GetFocusedItem(out int item);
    [PreserveSig] int GetItemPosition(IntPtr item, out IntPtr point);
    [PreserveSig] int GetSpacing(out IntPtr point);
    [PreserveSig] int GetDefaultSpacing(out IntPtr point);
    [PreserveSig] int GetAutoArrange();
    [PreserveSig] int SelectItem(int item, uint flags);
    [PreserveSig] int SelectAndPositionItems(uint count, IntPtr items, IntPtr points, uint flags);
    [PreserveSig] int SetGroupBy(IntPtr key, bool ascending);
    [PreserveSig] int GetGroupBy(IntPtr key, out bool ascending);
    [PreserveSig] int SetViewProperty(IntPtr item, IntPtr key, IntPtr value);
    [PreserveSig] int GetViewProperty(IntPtr item, IntPtr key, IntPtr value);
    [PreserveSig] int SetTileViewProperties(IntPtr item, IntPtr list);
    [PreserveSig] int SetExtendedTileViewProperties(IntPtr item, IntPtr list);
    [PreserveSig] int SetText(uint type, IntPtr text);
    [PreserveSig] int SetCurrentFolderFlags(uint mask, uint flags);
    [PreserveSig] int GetCurrentFolderFlags(out uint flags);
    [PreserveSig] int GetSortColumnCount(out int count);
    [PreserveSig] int SetSortColumns(IntPtr columns, int count);
    [PreserveSig] int GetSortColumns(IntPtr columns, int count);
    [PreserveSig] int GetItem(int item, ref Guid iid, out IntPtr value);
    [PreserveSig] int GetVisibleItem(int start, bool previous, out int item);
    [PreserveSig] int GetSelectedItem(int start, out int item);
    [PreserveSig] int GetSelection(bool noneImpliesFolder, out IntPtr items);
    [PreserveSig] int GetSelectionState(IntPtr item, out uint flags);
    [PreserveSig] int InvokeVerbOnSelection(IntPtr verb);
    [PreserveSig] int SetViewModeAndIconSize(uint mode, int size);
    [PreserveSig] int GetViewModeAndIconSize(out uint mode, out int size);
}

public static class ZhuoXuDesktopIcons
{
    private const uint FWF_AUTOARRANGE = 0x00000001;
    private const uint FWF_SNAPTOGRID = 0x00000004;
    private const uint SVSI_POSITIONITEM = 0x00000080;
    private const uint LVM_FIRST = 0x1000;
    private const uint LVM_GETITEMCOUNT = LVM_FIRST + 4;
    private const uint LVM_GETITEMPOSITION = LVM_FIRST + 16;
    private const uint LVM_GETITEMRECT = LVM_FIRST + 14;
    private const uint LVM_SETITEMPOSITION32 = LVM_FIRST + 49;
    private const uint LVM_GETITEMSPACING = LVM_FIRST + 51;
    private const uint LVM_GETITEMTEXTW = LVM_FIRST + 115;
    private const uint LVIF_TEXT = 0x0001;
    private const int GWL_STYLE = -16;
    private const int LVS_AUTOARRANGE = 0x0100;
    private const uint PROCESS_VM_OPERATION = 0x0008;
    private const uint PROCESS_VM_READ = 0x0010;
    private const uint PROCESS_VM_WRITE = 0x0020;
    private const uint MEM_COMMIT = 0x1000;
    private const uint MEM_RESERVE = 0x2000;
    private const uint MEM_RELEASE = 0x8000;
    private const uint PAGE_READWRITE = 0x04;
    private const uint WM_MOUSEWHEEL = 0x020A;
    private const int MK_CONTROL = 0x0008;
    private const int LVIR_ICON = 1;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct LVITEM
    {
        public uint mask;
        public int iItem;
        public int iSubItem;
        public uint state;
        public uint stateMask;
        public IntPtr pszText;
        public int cchTextMax;
        public int iImage;
        public IntPtr lParam;
        public int iIndent;
        public int iGroupId;
        public uint cColumns;
        public IntPtr puColumns;
        public IntPtr piColFmt;
        public int iGroup;
    }

    public class IconPosition
    {
        public string name { get; set; }
        public int x { get; set; }
        public int y { get; set; }
        public int index { get; set; }
    }

    public class Bounds
    {
        public int width { get; set; }
        public int height { get; set; }
    }

    public class Result
    {
        public bool ok { get; set; }
        public string error { get; set; }
        public int moved { get; set; }
        public int requested { get; set; }
        public int matched { get; set; }
        public List<IconPosition> items { get; set; }
        public Bounds bounds { get; set; }
        public int iconSize { get; set; }
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    private static IntPtr discoveredView = IntPtr.Zero;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr hWnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong(IntPtr hWnd, int index, int newValue);
    [DllImport("user32.dll")]
    private static extern bool InvalidateRect(IntPtr hWnd, IntPtr rect, bool erase);
    [DllImport("user32.dll")]
    private static extern bool UpdateWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr VirtualAllocEx(IntPtr process, IntPtr address, UIntPtr size, uint allocationType, uint protect);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool VirtualFreeEx(IntPtr process, IntPtr address, UIntPtr size, uint freeType);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(IntPtr process, IntPtr address, byte[] buffer, int size, out IntPtr bytesRead);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool WriteProcessMemory(IntPtr process, IntPtr address, byte[] buffer, int size, out IntPtr bytesWritten);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static IntPtr FindListView()
    {
        IntPtr progman = FindWindow("Progman", "Program Manager");
        IntPtr shellView = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (shellView == IntPtr.Zero)
        {
            discoveredView = IntPtr.Zero;
            EnumWindows(delegate(IntPtr window, IntPtr unused)
            {
                IntPtr candidate = FindWindowEx(window, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (candidate != IntPtr.Zero)
                {
                    discoveredView = candidate;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            shellView = discoveredView;
        }
        return shellView == IntPtr.Zero
            ? IntPtr.Zero
            : FindWindowEx(shellView, IntPtr.Zero, "SysListView32", "FolderView");
    }

    private static Bounds GetBounds(IntPtr listView)
    {
        RECT rect;
        GetClientRect(listView, out rect);
        return new Bounds { width = Math.Max(1, rect.Right - rect.Left), height = Math.Max(1, rect.Bottom - rect.Top) };
    }

    private static List<IconPosition> ReadItems(IntPtr listView)
    {
        uint processId;
        GetWindowThreadProcessId(listView, out processId);
        IntPtr process = OpenProcess(PROCESS_VM_OPERATION | PROCESS_VM_READ | PROCESS_VM_WRITE, false, processId);
        if (process == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to read the desktop process");

        int structSize = Marshal.SizeOf(typeof(LVITEM));
        const int textBytes = 2048;
        int allocationSize = structSize + textBytes;
        IntPtr remote = VirtualAllocEx(process, IntPtr.Zero, (UIntPtr)allocationSize, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if (remote == IntPtr.Zero)
        {
            CloseHandle(process);
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to allocate the desktop read buffer");
        }

        var result = new List<IconPosition>();
        try
        {
            int count = SendMessage(listView, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
            for (int index = 0; index < count; index++)
            {
                var item = new LVITEM
                {
                    mask = LVIF_TEXT,
                    iItem = index,
                    iSubItem = 0,
                    pszText = IntPtr.Add(remote, structSize),
                    cchTextMax = textBytes / 2
                };
                IntPtr local = Marshal.AllocHGlobal(structSize);
                IntPtr written;
                try
                {
                    Marshal.StructureToPtr(item, local, false);
                    byte[] itemBytes = new byte[structSize];
                    Marshal.Copy(local, itemBytes, 0, structSize);
                    WriteProcessMemory(process, remote, itemBytes, itemBytes.Length, out written);
                }
                finally
                {
                    Marshal.FreeHGlobal(local);
                }

                SendMessage(listView, LVM_GETITEMTEXTW, (IntPtr)index, remote);
                byte[] textBuffer = new byte[textBytes];
                IntPtr read;
                ReadProcessMemory(process, IntPtr.Add(remote, structSize), textBuffer, textBuffer.Length, out read);
                string name = Encoding.Unicode.GetString(textBuffer);
                int terminator = name.IndexOf('\0');
                if (terminator >= 0) name = name.Substring(0, terminator);

                byte[] pointBuffer = new byte[8];
                WriteProcessMemory(process, remote, pointBuffer, pointBuffer.Length, out written);
                SendMessage(listView, LVM_GETITEMPOSITION, (IntPtr)index, remote);
                ReadProcessMemory(process, remote, pointBuffer, pointBuffer.Length, out read);
                int x = BitConverter.ToInt32(pointBuffer, 0);
                int y = BitConverter.ToInt32(pointBuffer, 4);
                result.Add(new IconPosition { name = name, x = x, y = y, index = index });
            }
        }
        finally
        {
            VirtualFreeEx(process, remote, UIntPtr.Zero, MEM_RELEASE);
            CloseHandle(process);
        }
        return result;
    }

    private static void SetPosition(IntPtr listView, int index, int x, int y)
    {
        long packed = ((long)(ushort)y << 16) + (ushort)x;
        SendMessage(listView, LVM_SETITEMPOSITION32, (IntPtr)index, (IntPtr)packed);
    }

    private static void PositionItems(object desktop, List<IconPosition> items, List<POINT> points)
    {
        if (items.Count != points.Count) throw new ArgumentException("Desktop item and position counts differ");
        if (items.Count == 0) return;

        Guid service = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
        Guid browserIid = typeof(IShellBrowser).GUID;
        Guid folderIid = typeof(IFolderView2).GUID;
        IntPtr browserPointer = IntPtr.Zero;
        IntPtr viewPointer = IntPtr.Zero;
        IntPtr folderPointer = IntPtr.Zero;
        IntPtr itemArray = IntPtr.Zero;
        IntPtr pointArray = IntPtr.Zero;
        object browserObject = null;
        object folderObject = null;
        var itemPointers = new List<IntPtr>();
        try
        {
            int result = ((IServiceProvider)desktop).QueryService(ref service, ref browserIid, out browserPointer);
            if (result != 0 || browserPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            browserObject = Marshal.GetObjectForIUnknown(browserPointer);
            result = ((IShellBrowser)browserObject).QueryActiveShellView(out viewPointer);
            if (result != 0 || viewPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            result = Marshal.QueryInterface(viewPointer, ref folderIid, out folderPointer);
            if (result != 0 || folderPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            folderObject = Marshal.GetObjectForIUnknown(folderPointer);
            var folder = (IFolderView2)folderObject;

            result = folder.SetCurrentFolderFlags(FWF_AUTOARRANGE | FWF_SNAPTOGRID, 0);
            if (result != 0) Marshal.ThrowExceptionForHR(result);

            int pointSize = Marshal.SizeOf(typeof(POINT));
            itemArray = Marshal.AllocCoTaskMem(items.Count * IntPtr.Size);
            pointArray = Marshal.AllocCoTaskMem(items.Count * pointSize);
            for (int index = 0; index < items.Count; index++)
            {
                IntPtr itemPointer;
                result = folder.Item(items[index].index, out itemPointer);
                if (result != 0 || itemPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
                itemPointers.Add(itemPointer);
                Marshal.WriteIntPtr(itemArray, index * IntPtr.Size, itemPointer);
                Marshal.StructureToPtr(points[index], IntPtr.Add(pointArray, index * pointSize), false);
            }

            result = folder.SelectAndPositionItems((uint)items.Count, itemArray, pointArray, SVSI_POSITIONITEM);
            if (result != 0) Marshal.ThrowExceptionForHR(result);
        }
        finally
        {
            foreach (IntPtr itemPointer in itemPointers)
            {
                if (itemPointer != IntPtr.Zero) Marshal.FreeCoTaskMem(itemPointer);
            }
            if (pointArray != IntPtr.Zero) Marshal.FreeCoTaskMem(pointArray);
            if (itemArray != IntPtr.Zero) Marshal.FreeCoTaskMem(itemArray);
            if (folderObject != null && Marshal.IsComObject(folderObject)) Marshal.ReleaseComObject(folderObject);
            if (browserObject != null && Marshal.IsComObject(browserObject)) Marshal.ReleaseComObject(browserObject);
            if (folderPointer != IntPtr.Zero) Marshal.Release(folderPointer);
            if (viewPointer != IntPtr.Zero) Marshal.Release(viewPointer);
            if (browserPointer != IntPtr.Zero) Marshal.Release(browserPointer);
        }
    }

    private static int VerifyPositions(List<IconPosition> actual, List<IconPosition> expectedItems, List<POINT> expectedPoints, int toleranceX, int toleranceY)
    {
        var byIndex = new Dictionary<int, IconPosition>();
        foreach (IconPosition item in actual) byIndex[item.index] = item;
        int verified = 0;
        for (int index = 0; index < expectedItems.Count; index++)
        {
            IconPosition item;
            if (!byIndex.TryGetValue(expectedItems[index].index, out item)) continue;
            if (Math.Abs(item.x - expectedPoints[index].X) <= toleranceX && Math.Abs(item.y - expectedPoints[index].Y) <= toleranceY) verified++;
        }
        return verified;
    }

    private static int[] GetSpacing(IntPtr listView)
    {
        long packed = SendMessage(listView, LVM_GETITEMSPACING, IntPtr.Zero, IntPtr.Zero).ToInt64();
        int x = (int)(packed & 0xFFFF);
        int y = (int)((packed >> 16) & 0xFFFF);
        return new[] { x > 30 ? x : 82, y > 30 ? y : 86 };
    }

    private static int GetIconSize(IntPtr listView)
    {
        int count = SendMessage(listView, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
        if (count <= 0) throw new InvalidOperationException("Desktop icon list is not ready");

        uint processId;
        GetWindowThreadProcessId(listView, out processId);
        IntPtr process = OpenProcess(PROCESS_VM_OPERATION | PROCESS_VM_READ | PROCESS_VM_WRITE, false, processId);
        if (process == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to read the desktop process");
        IntPtr remote = VirtualAllocEx(process, IntPtr.Zero, (UIntPtr)16, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if (remote == IntPtr.Zero)
        {
            CloseHandle(process);
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to allocate the desktop size buffer");
        }

        try
        {
            byte[] rectBuffer = new byte[16];
            Buffer.BlockCopy(BitConverter.GetBytes(LVIR_ICON), 0, rectBuffer, 0, 4);
            IntPtr transferred;
            WriteProcessMemory(process, remote, rectBuffer, rectBuffer.Length, out transferred);
            IntPtr succeeded = SendMessage(listView, LVM_GETITEMRECT, IntPtr.Zero, remote);
            if (succeeded == IntPtr.Zero) throw new InvalidOperationException("Desktop icon size is not ready");
            ReadProcessMemory(process, remote, rectBuffer, rectBuffer.Length, out transferred);
            int width = Math.Abs(BitConverter.ToInt32(rectBuffer, 8) - BitConverter.ToInt32(rectBuffer, 0));
            int height = Math.Abs(BitConverter.ToInt32(rectBuffer, 12) - BitConverter.ToInt32(rectBuffer, 4));
            int measured = Math.Min(width, height) + 1;
            if (measured < 16 || measured > 256) throw new InvalidOperationException("Desktop returned an invalid icon size");
            return measured;
        }
        finally
        {
            VirtualFreeEx(process, remote, UIntPtr.Zero, MEM_RELEASE);
            CloseHandle(process);
        }
    }

    private static IntPtr WaitForListView()
    {
        for (int attempt = 0; attempt < 80; attempt++)
        {
            IntPtr listView = FindListView();
            if (listView != IntPtr.Zero && IsWindow(listView))
            {
                uint processId;
                uint threadId = GetWindowThreadProcessId(listView, out processId);
                int itemCount = SendMessage(listView, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
                if (threadId != 0 && processId != 0 && itemCount > 0)
                {
                    IntPtr process = OpenProcess(PROCESS_VM_OPERATION | PROCESS_VM_READ | PROCESS_VM_WRITE, false, processId);
                    if (process != IntPtr.Zero)
                    {
                        CloseHandle(process);
                        try
                        {
                            GetIconSize(listView);
                            Thread.Sleep(120);
                            IntPtr confirmed = FindListView();
                            if (confirmed == listView && IsWindow(confirmed)) return confirmed;
                        }
                        catch
                        {
                            // Explorer is still replacing the desktop list view.
                        }
                    }
                }
            }
            Thread.Sleep(50);
        }
        throw new InvalidOperationException("Windows desktop icon view was not found after changing icon size");
    }

    private static List<IconPosition> ReadItemsReady(ref IntPtr listView)
    {
        Exception lastError = null;
        for (int attempt = 0; attempt < 20; attempt++)
        {
            listView = WaitForListView();
            try
            {
                return ReadItems(listView);
            }
            catch (Exception error)
            {
                lastError = error;
                Thread.Sleep(120);
            }
        }
        throw lastError ?? new InvalidOperationException("Desktop icon list did not become readable");
    }

    private static void SendZoom(IntPtr listView, int delta)
    {
        long highWord = (long)(ushort)(short)delta << 16;
        SendMessage(listView, WM_MOUSEWHEEL, new IntPtr(highWord | MK_CONTROL), IntPtr.Zero);
    }

    public static int GetShellIconSize(object desktop)
    {
        Guid service = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
        Guid browserIid = typeof(IShellBrowser).GUID;
        Guid folderIid = typeof(IFolderView2).GUID;
        IntPtr browserPointer = IntPtr.Zero;
        IntPtr viewPointer = IntPtr.Zero;
        IntPtr folderPointer = IntPtr.Zero;
        object browserObject = null;
        object folderObject = null;
        try
        {
            int result = ((IServiceProvider)desktop).QueryService(ref service, ref browserIid, out browserPointer);
            if (result != 0 || browserPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            browserObject = Marshal.GetObjectForIUnknown(browserPointer);
            result = ((IShellBrowser)browserObject).QueryActiveShellView(out viewPointer);
            if (result != 0 || viewPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            result = Marshal.QueryInterface(viewPointer, ref folderIid, out folderPointer);
            if (result != 0 || folderPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            folderObject = Marshal.GetObjectForIUnknown(folderPointer);
            uint mode;
            int size;
            result = ((IFolderView2)folderObject).GetViewModeAndIconSize(out mode, out size);
            if (result != 0) Marshal.ThrowExceptionForHR(result);
            return size;
        }
        finally
        {
            if (folderObject != null && Marshal.IsComObject(folderObject)) Marshal.ReleaseComObject(folderObject);
            if (browserObject != null && Marshal.IsComObject(browserObject)) Marshal.ReleaseComObject(browserObject);
            if (folderPointer != IntPtr.Zero) Marshal.Release(folderPointer);
            if (viewPointer != IntPtr.Zero) Marshal.Release(viewPointer);
            if (browserPointer != IntPtr.Zero) Marshal.Release(browserPointer);
        }
    }

    public static void DisableAutoArrange(object desktop)
    {
        Guid service = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
        Guid browserIid = typeof(IShellBrowser).GUID;
        Guid folderIid = typeof(IFolderView2).GUID;
        IntPtr browserPointer = IntPtr.Zero;
        IntPtr viewPointer = IntPtr.Zero;
        IntPtr folderPointer = IntPtr.Zero;
        object browserObject = null;
        object folderObject = null;
        try
        {
            int result = ((IServiceProvider)desktop).QueryService(ref service, ref browserIid, out browserPointer);
            if (result != 0 || browserPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            browserObject = Marshal.GetObjectForIUnknown(browserPointer);
            result = ((IShellBrowser)browserObject).QueryActiveShellView(out viewPointer);
            if (result != 0 || viewPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            result = Marshal.QueryInterface(viewPointer, ref folderIid, out folderPointer);
            if (result != 0 || folderPointer == IntPtr.Zero) Marshal.ThrowExceptionForHR(result);
            folderObject = Marshal.GetObjectForIUnknown(folderPointer);
            result = ((IFolderView2)folderObject).SetCurrentFolderFlags(FWF_AUTOARRANGE, 0);
            if (result != 0) Marshal.ThrowExceptionForHR(result);
        }
        finally
        {
            if (folderObject != null && Marshal.IsComObject(folderObject)) Marshal.ReleaseComObject(folderObject);
            if (browserObject != null && Marshal.IsComObject(browserObject)) Marshal.ReleaseComObject(browserObject);
            if (folderPointer != IntPtr.Zero) Marshal.Release(folderPointer);
            if (viewPointer != IntPtr.Zero) Marshal.Release(viewPointer);
            if (browserPointer != IntPtr.Zero) Marshal.Release(browserPointer);
        }
    }

    public static void StepIconSize(bool increase)
    {
        IntPtr listView = RequireListView();
        SendZoom(listView, increase ? 120 : -120);
    }

    private static IntPtr RequireListView()
    {
        return WaitForListView();
    }

    public static Result Capture()
    {
        try
        {
            IntPtr listView = RequireListView();
            return new Result { ok = true, items = ReadItems(listView), bounds = GetBounds(listView), iconSize = GetIconSize(listView) };
        }
        catch (Exception error)
        {
            return new Result { ok = false, error = error.Message, items = new List<IconPosition>(), bounds = new Bounds() };
        }
    }

    public static Result Arrange(object desktop, string[] names, int[] groupSizes, string mode, int appliedIconSize)
    {
        try
        {
            IntPtr listView = RequireListView();
            var current = ReadItemsReady(ref listView);
            var lookup = new Dictionary<string, IconPosition>(StringComparer.CurrentCultureIgnoreCase);
            foreach (IconPosition item in current)
            {
                if (!lookup.ContainsKey(item.name)) lookup.Add(item.name, item);
            }

            int style = GetWindowLong(listView, GWL_STYLE);
            if ((style & LVS_AUTOARRANGE) != 0) SetWindowLong(listView, GWL_STYLE, style & ~LVS_AUTOARRANGE);

            Bounds bounds = GetBounds(listView);
            int[] spacing = GetSpacing(listView);
            int gridX = spacing[0];
            int gridY = spacing[1];
            int margin = 18;
            var targetItems = new List<IconPosition>();
            var targetPoints = new List<POINT>();

            if (String.Equals(mode, "horizontal", StringComparison.OrdinalIgnoreCase))
            {
                int halfWidth = Math.Max(gridX + margin * 2, bounds.width / 2);
                int maxColumns = Math.Max(1, (halfWidth - margin * 2) / gridX);
                int maxRows = Math.Max(1, (bounds.height - margin * 2) / gridY);
                int itemIndex = 0;
                int side = 0;
                int row = 0;
                foreach (int rawSize in groupSizes)
                {
                    int size = Math.Max(0, rawSize);
                    int neededRows = Math.Max(1, (int)Math.Ceiling(size / (double)maxColumns));
                    if (side == 0 && row + neededRows > maxRows)
                    {
                        side = 1;
                        row = 0;
                    }
                    for (int withinGroup = 0; withinGroup < size && itemIndex < names.Length; withinGroup++, itemIndex++)
                    {
                        IconPosition item;
                        if (!lookup.TryGetValue(names[itemIndex], out item)) continue;
                        int col = withinGroup % maxColumns;
                        int localRow = row + withinGroup / maxColumns;
                        int x = margin + side * halfWidth + col * gridX;
                        int y = margin + localRow * gridY;
                        targetItems.Add(item);
                        targetPoints.Add(new POINT { X = x, Y = y });
                    }
                    row += neededRows;
                    if (side == 1 && row >= maxRows) row = 0;
                }
            }
            else
            {
                int maxRows = Math.Max(1, (bounds.height - margin * 2) / gridY);
                for (int i = 0; i < names.Length; i++)
                {
                    IconPosition item;
                    if (!lookup.TryGetValue(names[i], out item)) continue;
                    int x = margin + (i / maxRows) * gridX;
                    int y = margin + (i % maxRows) * gridY;
                    targetItems.Add(item);
                    targetPoints.Add(new POINT { X = x, Y = y });
                }
            }

            if (targetItems.Count != names.Length)
                throw new InvalidOperationException(String.Format("Only {0} of {1} desktop icons could be matched", targetItems.Count, names.Length));
            PositionItems(desktop, targetItems, targetPoints);
            Thread.Sleep(250);
            InvalidateRect(listView, IntPtr.Zero, true);
            UpdateWindow(listView);
            var arranged = ReadItemsReady(ref listView);
            int moved = VerifyPositions(arranged, targetItems, targetPoints, Math.Max(2, gridX / 2), Math.Max(2, gridY / 2));
            if (moved != targetItems.Count)
                throw new InvalidOperationException(String.Format("Windows applied {0} of {1} desktop icon positions", moved, targetItems.Count));
            return new Result { ok = true, moved = moved, requested = names.Length, matched = targetItems.Count, items = arranged, bounds = bounds, iconSize = appliedIconSize };
        }
        catch (Exception error)
        {
            return new Result { ok = false, error = error.Message, items = new List<IconPosition>(), bounds = new Bounds() };
        }
    }

    public static Result Restore(object desktop, string[] names, int[] xs, int[] ys, int appliedIconSize)
    {
        try
        {
            IntPtr listView = RequireListView();
            var current = ReadItemsReady(ref listView);
            var lookup = new Dictionary<string, IconPosition>(StringComparer.CurrentCultureIgnoreCase);
            foreach (IconPosition item in current)
            {
                if (!lookup.ContainsKey(item.name)) lookup.Add(item.name, item);
            }
            int style = GetWindowLong(listView, GWL_STYLE);
            if ((style & LVS_AUTOARRANGE) != 0) SetWindowLong(listView, GWL_STYLE, style & ~LVS_AUTOARRANGE);
            var targetItems = new List<IconPosition>();
            var targetPoints = new List<POINT>();
            for (int i = 0; i < names.Length && i < xs.Length && i < ys.Length; i++)
            {
                IconPosition item;
                if (!lookup.TryGetValue(names[i], out item)) continue;
                targetItems.Add(item);
                targetPoints.Add(new POINT { X = xs[i], Y = ys[i] });
            }
            if (targetItems.Count != names.Length)
                throw new InvalidOperationException(String.Format("Only {0} of {1} desktop icons could be matched for restore", targetItems.Count, names.Length));
            PositionItems(desktop, targetItems, targetPoints);
            Thread.Sleep(250);
            InvalidateRect(listView, IntPtr.Zero, true);
            UpdateWindow(listView);
            var restored = ReadItemsReady(ref listView);
            int moved = VerifyPositions(restored, targetItems, targetPoints, 2, 2);
            if (moved != targetItems.Count)
                throw new InvalidOperationException(String.Format("Windows restored {0} of {1} desktop icon positions", moved, targetItems.Count));
            return new Result { ok = true, moved = moved, requested = names.Length, matched = targetItems.Count, items = restored, bounds = GetBounds(listView), iconSize = appliedIconSize };
        }
        catch (Exception error)
        {
            return new Result { ok = false, error = error.Message, items = new List<IconPosition>(), bounds = new Bounds() };
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $source -Language CSharp

    function Get-DesktopIconSize {
        $shellApplication = $null
        $shellWindows = $null
        $desktopDispatch = $null
        try {
            for ($attempt = 0; $attempt -lt 50 -and $null -eq $desktopDispatch; $attempt += 1) {
                if ($null -ne $shellWindows -and [Runtime.InteropServices.Marshal]::IsComObject($shellWindows)) {
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shellWindows)
                    $shellWindows = $null
                }
                if ($null -ne $shellApplication -and [Runtime.InteropServices.Marshal]::IsComObject($shellApplication)) {
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shellApplication)
                    $shellApplication = $null
                }
                $shellApplication = New-Object -ComObject Shell.Application
                $shellWindows = $shellApplication.Windows()
                $location = 0
                $root = 0
                $desktopHwnd = 0
                $desktopDispatch = $shellWindows.FindWindowSW([ref]$location, [ref]$root, 8, [ref]$desktopHwnd, 1)
                if ($null -eq $desktopDispatch) { Start-Sleep -Milliseconds 100 }
            }
            if ($null -eq $desktopDispatch) { throw 'Windows desktop shell view was not found' }
            return [ZhuoXuDesktopIcons]::GetShellIconSize($desktopDispatch)
        }
        finally {
            foreach ($comObject in @($desktopDispatch, $shellWindows, $shellApplication)) {
                if ($null -ne $comObject -and [Runtime.InteropServices.Marshal]::IsComObject($comObject)) {
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($comObject)
                }
            }
        }
    }

    function Wait-DesktopIconSizeChange([int]$PreviousSize) {
        for ($attempt = 0; $attempt -lt 25; $attempt += 1) {
            Start-Sleep -Milliseconds 120
            try {
                $nextSize = Get-DesktopIconSize
                if ($nextSize -ne $PreviousSize) { return $nextSize }
            }
            catch {
                # Explorer can briefly recreate its desktop view between zoom levels.
            }
        }
        return $PreviousSize
    }

    function Set-DesktopIconSize([int]$RequestedSize) {
        $target = [Math]::Max(32, [Math]::Min(96, $RequestedSize))
        $current = Get-DesktopIconSize
        $best = $current
        $bestDistance = [Math]::Abs($target - $current)

        for ($step = 0; $step -lt 24 -and $bestDistance -gt 0; $step += 1) {
            $increase = $target -gt $current
            [ZhuoXuDesktopIcons]::StepIconSize($increase)
            $next = Wait-DesktopIconSizeChange $current
            if ($next -eq $current) { throw 'Windows did not apply the requested desktop icon size' }

            $nextDistance = [Math]::Abs($target - $next)
            if ($nextDistance -lt $bestDistance) {
                $best = $next
                $bestDistance = $nextDistance
            }

            $crossedTarget = (($target - $current) * ($target - $next)) -lt 0
            if ($crossedTarget) {
                if ($best -eq $current) {
                    [ZhuoXuDesktopIcons]::StepIconSize(-not $increase)
                    $restoredSize = Wait-DesktopIconSizeChange $next
                    if ($restoredSize -ne $current) { throw 'Windows could not return to the nearest desktop icon size' }
                    return $restoredSize
                }
                return $next
            }

            $current = $next
        }
        return $best
    }

    function New-DesktopContext {
        $shellApplication = $null
        $shellWindows = $null
        $desktopDispatch = $null
        try {
            for ($attempt = 0; $attempt -lt 50 -and $null -eq $desktopDispatch; $attempt += 1) {
                if ($null -ne $shellWindows -and [Runtime.InteropServices.Marshal]::IsComObject($shellWindows)) {
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shellWindows)
                    $shellWindows = $null
                }
                if ($null -ne $shellApplication -and [Runtime.InteropServices.Marshal]::IsComObject($shellApplication)) {
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shellApplication)
                    $shellApplication = $null
                }
                $shellApplication = New-Object -ComObject Shell.Application
                $shellWindows = $shellApplication.Windows()
                $location = 0
                $root = 0
                $desktopHwnd = 0
                $desktopDispatch = $shellWindows.FindWindowSW([ref]$location, [ref]$root, 8, [ref]$desktopHwnd, 1)
                if ($null -eq $desktopDispatch) { Start-Sleep -Milliseconds 100 }
            }
            if ($null -eq $desktopDispatch) { throw 'Windows desktop shell view was not found' }
            return [pscustomobject]@{
                ShellApplication = $shellApplication
                ShellWindows = $shellWindows
                DesktopDispatch = $desktopDispatch
            }
        }
        catch {
            foreach ($comObject in @($desktopDispatch, $shellWindows, $shellApplication)) {
                if ($null -ne $comObject -and [Runtime.InteropServices.Marshal]::IsComObject($comObject)) {
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($comObject)
                }
            }
            throw
        }
    }

    function Close-DesktopContext($Context) {
        if ($null -eq $Context) { return }
        foreach ($comObject in @($Context.DesktopDispatch, $Context.ShellWindows, $Context.ShellApplication)) {
            if ($null -ne $comObject -and [Runtime.InteropServices.Marshal]::IsComObject($comObject)) {
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($comObject)
            }
        }
    }

    if ($Action -eq 'capture') {
        $result = [ZhuoXuDesktopIcons]::Capture()
        if ($result.ok) { $result.iconSize = Get-DesktopIconSize }
    }
    else {
        if (-not $PayloadPath -or -not (Test-Path -LiteralPath $PayloadPath)) {
            throw 'Layout payload file is missing'
        }
        $payload = [IO.File]::ReadAllText($PayloadPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
        $requestedIconSize = if ($null -ne $payload.iconSize -and [int]$payload.iconSize -gt 0) {
            [int]$payload.iconSize
        }
        else {
            Get-DesktopIconSize
        }
        $appliedIconSize = Set-DesktopIconSize $requestedIconSize

        $desktopContext = New-DesktopContext
        try {
            if ($Action -eq 'arrange') {
                $names = New-Object System.Collections.Generic.List[string]
                $sizes = New-Object System.Collections.Generic.List[int]
                foreach ($group in @($payload.groups)) {
                    $groupItems = @($group.items)
                    $sizes.Add($groupItems.Count)
                    foreach ($item in $groupItems) {
                        $shellName = if (-not [string]::IsNullOrWhiteSpace([string]$item.shellName)) {
                            [string]$item.shellName
                        }
                        elseif (-not [string]::IsNullOrWhiteSpace([string]$item.fileName)) {
                            [string]$item.fileName
                        }
                        else {
                            [string]$item.name
                        }
                        $names.Add($shellName)
                    }
                }
                $result = [ZhuoXuDesktopIcons]::Arrange($desktopContext.DesktopDispatch, $names.ToArray(), $sizes.ToArray(), [string]$payload.mode, $appliedIconSize)
            }
            else {
                $items = @($payload.items)
                [string[]]$names = @($items | ForEach-Object { [string]$_.name })
                [int[]]$xs = @($items | ForEach-Object { [int]$_.x })
                [int[]]$ys = @($items | ForEach-Object { [int]$_.y })
                $result = [ZhuoXuDesktopIcons]::Restore($desktopContext.DesktopDispatch, $names, $xs, $ys, $appliedIconSize)
            }
        }
        finally {
            Close-DesktopContext $desktopContext
        }
    }

    $result | ConvertTo-Json -Depth 6 -Compress
}
catch {
    @{ ok = $false; error = $_.Exception.Message; items = @() } | ConvertTo-Json -Compress
}
